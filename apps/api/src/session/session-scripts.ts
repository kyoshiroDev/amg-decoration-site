// Scripts Lua du magasin de sessions (ADR-0023, « Magasin de sessions ») : chaque opération est un
// seul script, exécuté d'un bloc par Redis (aucune lecture suivie d'une écriture côté Node). L'heure
// est passée par l'API (ARGV) ; l'expiration Redis (PEXPIREAT) n'est qu'un ramasse-miettes.
// Redis autonome seulement : les scripts lisent des clés de session dérivées de l'index d'un compte.
//
// Hachage d'une session (`<préfixe>sess:<empreinte>`) : v (version), pid (identifiant public),
// uid, aud, stg (étape), ca (création), ls (dernière activité), ae (échéance absolue), it (délai
// d'inactivité), aa (dernière authentification), dev (appareil), net (réseau tronqué) ; dates en
// millisecondes. Index (`<préfixe>sess-idx:<audience>:<uid>`) : ensemble ordonné, membre =
// empreinte, score = date de création.

/** Fonctions communes, en tête de chaque script. */
const COMMON = `
local FIELDS = {'v','pid','uid','aud','stg','ca','ls','ae','it','aa','dev','net'}
local function fmt(n) return string.format('%.0f', n) end
local function read(key)
  local f = redis.call('HMGET', key, unpack(FIELDS))
  if not f[1] then return nil end
  return f
end
-- Vivante si dernière activité + inactivité et échéance absolue sont dans le futur.
local function alive(f, now)
  local ls, ae, it = tonumber(f[7]), tonumber(f[8]), tonumber(f[9])
  return ls ~= nil and ae ~= nil and it ~= nil and now - ls < it and now < ae
end
local function drop(sess_prefix, idx_prefix, member, f)
  redis.call('DEL', sess_prefix .. member)
  if f then redis.call('ZREM', idx_prefix .. f[4] .. ':' .. f[3], member) end
end
`;

/**
 * Création. KEYS : session, index. ARGV : maintenant, pid, uid, audience, étape, durée absolue,
 * inactivité, limite, appareil, réseau, empreinte, préfixe des sessions.
 * Rend les identifiants publics des sessions révoquées au-delà de la limite.
 */
export const CREATE_SCRIPT = `${COMMON}
if redis.call('EXISTS', KEYS[1]) == 1 then return redis.error_reply('AMG collision') end
local now = tonumber(ARGV[1])
local abs = now + tonumber(ARGV[6])
local it = tonumber(ARGV[7])
local max = tonumber(ARGV[8])
local sess_prefix = ARGV[12]
for _, m in ipairs(redis.call('ZRANGE', KEYS[2], 0, -1)) do
  local f = read(sess_prefix .. m)
  if not f or not alive(f, now) then
    redis.call('DEL', sess_prefix .. m)
    redis.call('ZREM', KEYS[2], m)
  end
end
redis.call('HSET', KEYS[1], 'v', '1', 'pid', ARGV[2], 'uid', ARGV[3], 'aud', ARGV[4], 'stg', ARGV[5],
  'ca', ARGV[1], 'ls', ARGV[1], 'ae', fmt(abs), 'it', ARGV[7], 'aa', ARGV[1], 'dev', ARGV[9],
  'net', ARGV[10])
redis.call('PEXPIREAT', KEYS[1], fmt(math.min(now + it, abs)))
redis.call('ZADD', KEYS[2], ARGV[1], ARGV[11])
local evicted = {}
while redis.call('ZCARD', KEYS[2]) > max do
  local oldest = redis.call('ZRANGE', KEYS[2], 0, 1)
  local victim = oldest[1]
  if victim == ARGV[11] then victim = oldest[2] end
  redis.call('ZREM', KEYS[2], victim)
  local pid = redis.call('HGET', sess_prefix .. victim, 'pid')
  redis.call('DEL', sess_prefix .. victim)
  if pid then table.insert(evicted, pid) end
end
redis.call('PEXPIREAT', KEYS[2], fmt(abs))
return evicted
`;

/**
 * Validation d'une requête. KEYS : session. ARGV : maintenant, audience attendue, empreinte,
 * préfixe des sessions, préfixe des index.
 * Rend nil (absente ou expirée, alors supprimée), {'audience', uid, pid} (autre audience, intacte)
 * ou {'valid', champs…} après mise à jour de la dernière activité.
 */
export const VALIDATE_SCRIPT = `${COMMON}
local now = tonumber(ARGV[1])
local f = read(KEYS[1])
if not f then return false end
if not alive(f, now) then
  drop(ARGV[4], ARGV[5], ARGV[3], f)
  return false
end
if f[4] ~= ARGV[2] then return {'audience', f[3], f[2]} end
f[7] = ARGV[1]
redis.call('HSET', KEYS[1], 'ls', ARGV[1])
redis.call('PEXPIREAT', KEYS[1], fmt(math.min(now + tonumber(f[9]), tonumber(f[8]))))
return {'valid', unpack(f)}
`;

/**
 * Rotation. KEYS : ancienne session, nouvelle session. ARGV : maintenant, audience attendue,
 * ancienne empreinte, nouvelle empreinte, nouveau pid, nouvelle étape ('' : inchangée),
 * ré-authentification ('1' ou '0'), préfixe des sessions, préfixe des index.
 * Rend nil (ancienne invalide) ou {'valid', champs de la nouvelle…}. Création, échéance absolue
 * et délai d'inactivité sont conservés : une rotation ne prolonge jamais la durée absolue.
 */
export const ROTATE_SCRIPT = `${COMMON}
local now = tonumber(ARGV[1])
local f = read(KEYS[1])
if not f then return false end
if not alive(f, now) then
  drop(ARGV[8], ARGV[9], ARGV[3], f)
  return false
end
if f[4] ~= ARGV[2] then return false end
if redis.call('EXISTS', KEYS[2]) == 1 then return redis.error_reply('AMG collision') end
f[2] = ARGV[5]
if ARGV[6] ~= '' then f[5] = ARGV[6] end
f[7] = ARGV[1]
if ARGV[7] == '1' then f[10] = ARGV[1] end
local args = {}
for i, name in ipairs(FIELDS) do
  table.insert(args, name)
  table.insert(args, f[i])
end
redis.call('HSET', KEYS[2], unpack(args))
redis.call('PEXPIREAT', KEYS[2], fmt(math.min(now + tonumber(f[9]), tonumber(f[8]))))
redis.call('DEL', KEYS[1])
local idx = ARGV[9] .. f[4] .. ':' .. f[3]
redis.call('ZREM', idx, ARGV[3])
redis.call('ZADD', idx, f[6], ARGV[4])
return {'valid', unpack(f)}
`;

/**
 * Révocation par jeton. KEYS : session. ARGV : audience attendue, empreinte, préfixe des sessions,
 * préfixe des index. Rend nil ou les champs de la session révoquée.
 */
export const REVOKE_SCRIPT = `${COMMON}
local f = read(KEYS[1])
if not f or f[4] ~= ARGV[1] then return false end
drop(ARGV[3], ARGV[4], ARGV[2], f)
return f
`;

/**
 * Révocation par identifiant public, dans l'index du compte seulement. KEYS : index. ARGV : pid,
 * préfixe des sessions. Rend 1 si une session a été révoquée, 0 sinon.
 */
export const REVOKE_PUBLIC_ID_SCRIPT = `${COMMON}
for _, m in ipairs(redis.call('ZRANGE', KEYS[1], 0, -1)) do
  local pid = redis.call('HGET', ARGV[2] .. m, 'pid')
  if not pid then
    redis.call('ZREM', KEYS[1], m)
  elseif pid == ARGV[1] then
    redis.call('DEL', ARGV[2] .. m)
    redis.call('ZREM', KEYS[1], m)
    return 1
  end
end
return 0
`;

/** Révocation de toutes les sessions d'un compte. KEYS : index. ARGV : préfixe des sessions. */
export const REVOKE_ALL_SCRIPT = `${COMMON}
local count = 0
for _, m in ipairs(redis.call('ZRANGE', KEYS[1], 0, -1)) do
  count = count + redis.call('DEL', ARGV[1] .. m)
end
redis.call('DEL', KEYS[1])
return count
`;

/**
 * Liste des sessions vivantes d'un compte (les autres sont purgées). KEYS : index. ARGV :
 * maintenant, préfixe des sessions. Rend une liste de listes de champs, de la plus ancienne à la
 * plus récente.
 */
export const LIST_SCRIPT = `${COMMON}
local now = tonumber(ARGV[1])
local out = {}
for _, m in ipairs(redis.call('ZRANGE', KEYS[1], 0, -1)) do
  local f = read(ARGV[2] .. m)
  if f and alive(f, now) then
    table.insert(out, f)
  else
    redis.call('DEL', ARGV[2] .. m)
    redis.call('ZREM', KEYS[1], m)
  end
end
return out
`;
