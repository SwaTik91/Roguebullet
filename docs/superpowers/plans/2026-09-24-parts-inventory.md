# Инвентарь запчастей — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Игрок получает запчасти за пройденный уровень и за каждые 5 волн бесконечного режима, хранит их в инвентаре и надевает до восьми штук, которые меняют числа боя.

**Architecture:** Правила детали, броска, слотов и потолков живут в `src/parts.js`. Python-сервер хранит детали и сборку, бросает их через этот модуль и отдаёт в профиле. Клиент в начале забега применяет только надетые детали. Совместный бой и прокачка деталей не делаются.

**Tech Stack:** JavaScript ESM (Vite, node:test), Python http.server API, SQLite.

## Global Constraints

- Совместный бой не менять.
- Прокачки запчастей нет. Дубликаты только лежат в инвентаре.
- Ангар (мощность, обшивка, конденсатор) не менять.
- Бонус дают только надетые детали.
- Восемь слотов: индексы 0–3 оружейные, 4–7 общие.
- Две детали с одной основой надеть нельзя. Текст отказа: «Такая уже надета». Нет слота: «Нет свободного слота».
- Общая деталь не встаёт в оружейный слот.
- Пустой оружейный слот принимает любое семейство оружия. Занятый принимает только то же семейство, и только после снятия текущей детали.
- Редкость: обычная 55%, редкая 30%, эпическая 10%, легендарная 5%. Шаг: 1, 2, 3, 4.
- Шанс дропа с уровня 45%. Каждые 5 волн бесконечного режима 30%. Пять сухих успешных уровней гарантируют деталь на следующем, без гарантии редкости. Бесконечный режим счётчик не трогает.
- Семейство: 40% общее, 60% поровну между открытым оружием. Пулемёт и дрон открыты всегда.
- Два разных свойства. Дробины, рикошет и лишняя сфера только с эпика.
- Потолки и формулы — как в `docs/superpowers/specs/2026-09-24-parts-inventory-design.md`.
- Бросок делает сервер. Повтор того же ключа возвращает ту же деталь.
- Порты 443 и 8443 не трогать. Не перезапускать xray.
- Коммит: `git -c user.name="PolySpire Agent" -c user.email="agent@local"`.
- Интерфейс на русском.

---

### Task 1: Каталог, бросок, слоты и потолки

**Files:**
- Create: `src/parts.js`
- Test: `test/parts.test.js`
- Modify: `package.json` (добавить `test/parts.test.js` в скрипт `test`)

**Interfaces:**
- Consumes: ничего
- Produces:
  - `BASES`, `AFFIXES`, `RARITY_STEP`
  - `rollPart(rng, ownedWeapons) -> part` где part = `{ id, base, baseName, family, rarity, affixes: [{ id, name, step }] }`. `family` равен `null` у общей детали. `id` задаёт вызывающий через `options.id`, иначе `rollPart` не ставит id.
  - `rollPart(rng, ownedWeapons, { id, forceDrop })` — `forceDrop` не используется здесь; дроп/мимо считает сервер.
  - `describeAffix(family, affix) -> string` русская строка для экрана.
  - `firstSlot(parts, slots, partId) -> { slots } | { error }`
  - `equipAt(parts, slots, partId, index) -> { slots } | { error }`
  - `unequip(slots, index) -> slots`
  - `sumBonuses(parts, slots) -> bonuses` объект чисел уже после потолков: `gunDmg`, `gunRate`, `gunPierce`, `gunBounce`, `droneDmg`, `droneCd`, `dronePierce`, `droneLife`, `laserDmg`, `laserWidth`, `laserCd`, `laserBounce`, `scatterDmg`, `scatterPellets`, `scatterKnock`, `scatterPierce`, `grenadeDmg`, `grenadeRadius`, `grenadeCd`, `grenadePool`, `empDmg`, `empRadius`, `empSlowDur`, `empSlowMul`, `orbDmg`, `orbRadius`, `orbSpin`, `orbCount`, `allDmg`, `hp`, `regen`, `crit`, `charge`, `overDur`.
  - `applyBonuses(run, bonuses)` меняет `run` на месте.

- [ ] **Step 1: Write the failing test**

Создать `test/parts.test.js`. Генератор:

```javascript
function rngFrom(values) {
  let i = 0;
  return () => values[i++] ?? 0;
}
```

Проверки:

- `rollPart(rngFrom([0.39, 0, 0, 0, 0.1]), [])` — общая деталь (0.39 < 0.40), первая основа «Ядро», редкость обычная (0 попадает в 55%).
- `rollPart(rngFrom([0.50, 0, 0, 0.2, 0.5]), ["laser"])` — семейство оружие (0.50 >= 0.40), среди gun/drone/laser индекс 0 это gun, основа «Ствол».
- На 2000 бросках с `Math.random` и `owned=[]` доли редкостей около 0.55 / 0.30 / 0.10 / 0.05 (±0.04).
- Обычная и редкая деталь пулемёта не содержат affix id `bounce`. Эпик может.
- Два affix id на детали различаются.
- `firstSlot` пустой сборки и пулемётной детали кладёт её в слот 0.
- Вторая деталь с тем же `base` даёт `{ error: "Такая уже надета" }`.
- Четыре разные основы пулемёта занимают слоты 0–3. Пятая другая основа пулемёта идёт в слот 4.
- Общая деталь при пустых слотах идёт в слот 4, не в 0.
- `equipAt` общей детали в индекс 0 даёт ошибку.
- `equipAt` лазерной детали в слот, где уже пулемёт, даёт ошибку.
- `equipAt` лазерной детали в пустой слот 1 проходит.
- `sumBonuses` двух легендарных (step 4) affix `dmg` пулемёта даёт `gunDmg === 0.4` (0.16+0.16 обрезано до 0.40).
- `sumBonuses` общей легенды `hp` step 4 и ещё трёх таких же не надетых не растит `hp`. Надетая одна даёт `hp === 60`. Четыре надетые дают `hp === 150`.
- `applyBonuses` ставит `run.gun.dmg` в `17 * 1.4` при `gunDmg 0.4` и базовых 17, и `run.tower.maxHp` на +150 при `hp: 150`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/parts.test.js`
Expected: FAIL, нет модуля `../src/parts.js`

- [ ] **Step 3: Write minimal implementation**

`src/parts.js` реализует интерфейс выше. Таблицы свойств и потолки скопировать из спецификации, не выдумывать новые статы. `applyBonuses` делает:

- `run.gun.dmg *= 1 + bonuses.gunDmg + bonuses.allDmg`
- `run.gun.rate += bonuses.gunRate`
- `run.gun.pierce += bonuses.gunPierce`
- `run.gun.bounces += bonuses.gunBounce`
- для каждого оружия в `run.wepStats`, если оно есть: урон `*= 1 + familyDmg + allDmg`, остальные поля прибавкой
- `run.drone` теми же правилами, что `wepStats.drone`, если блок `run.drone` есть
- `run.tower.maxHp += bonuses.hp`, `run.tower.hp += bonuses.hp`, `run.tower.regen += bonuses.regen`
- `run.crit.chance += bonuses.crit`
- `run.overdrive.chargeGain += bonuses.charge`
- `run.overdrive.dur += bonuses.overDur`
- пол и крыша из спецификации после этих прибавок: drone cd ≥ 0.12, laser width ≤ 22, laser cd ≥ 0.35, grenade radius ≤ 140, grenade cd ≥ 0.8, emp radius ≤ 190, emp slow duration ≤ 2.6, emp slow multiplier ≥ 0.15

Добавить `test/parts.test.js` в `package.json` script `test` сразу после `test/battle.test.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/parts.test.js` затем `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/parts.js test/parts.test.js package.json
git -c user.name="PolySpire Agent" -c user.email="agent@local" commit -m "Add part rolls, equip rules, and bonus caps."
```

---

### Task 2: Сервер хранит детали и бросает их

**Files:**
- Modify: `server/store.py`
- Modify: `server/app.py`
- Modify: `server/test_store.py`
- Create: `server/parts_bridge.py` — запускает `node server/parts-cli.mjs`
- Create: `server/parts-cli.mjs` — читает JSON из stdin, импортирует `../src/parts.js`, пишет JSON в stdout

**Interfaces:**
- Consumes: `rollPart`, `firstSlot`, `equipAt`, `unequip` из `src/parts.js`
- Produces:
  - профиль содержит `parts` (массив) и `loadout` (8 id или null) и `partsDry` (число)
  - `POST /parts/roll` body `{ runId, kind, level, wave }` → `{ part, profile }` или `{ part: null, profile }`
  - `POST /parts/equip` body `{ partId }` → `{ profile }` или 400 `{ error }`
  - `POST /parts/unequip` body `{ slot }` → `{ profile }`

- [ ] **Step 1: Write the failing test**

В `server/test_store.py` на временной базе:

- Новый аккаунт: `parts == []`, `loadout == [None]*8`, `partsDry == 0`.
- `roll_part` с rng, который всегда меньше 0.45, и `kind="level"` создаёт одну деталь. Повтор того же `runId` и `level` возвращает ту же деталь, в списке она одна.
- Пять вызовов с rng ≥ 0.45 увеличивают `partsDry` до 5 и не создают деталь. Шестой вызов с тем же сухим rng создаёт деталь и обнуляет `partsDry`.
- `kind="endless"` при wave 4 не бросает. При wave 5 бросает один раз (если rng < 0.30). Повтор не дублирует. `partsDry` не меняется.
- `equip_part` второй детали той же основы возвращает ошибку «Такая уже надета».
- Общая деталь не занимает слот 0, если слоты пустые: она в слоте 4.

Rng передавать аргументом в метод store, как у сундука. Мост node использовать только если тест не подменяет бросок. Для тестов store принимать уже готовый `part` от внедрённой функции `roller(rng, owned)`, по умолчанию она зовёт node-мост.

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest server.test_store -v`
Expected: FAIL, нет `roll_part`

- [ ] **Step 3: Write minimal implementation**

Таблица `account_parts (id TEXT PRIMARY KEY, account_id, base, base_name, family, rarity, affixes_json)`.
Таблица `part_rolls (account_id, roll_key TEXT, part_id, PRIMARY KEY(account_id, roll_key))`.
Колонки `accounts.loadout_json TEXT NOT NULL DEFAULT '[null,null,null,null,null,null,null,null]'` и `accounts.parts_dry INTEGER NOT NULL DEFAULT 0`. Миграция как у существующих колонок: добавить, если нет.

`roll_key` для уровня: `f"{runId}:level:{level}"`. Для бесконечного режима: `f"{runId}:endless:{wave}"` только если `int(wave) % 5 == 0` и wave > 0. Иначе `{ part: null }` без записи.

Шанс: level 0.45, endless 0.30. Если `kind=="level"` и `parts_dry >= 5`, шанс игнорируется и деталь создаётся. После сухого уровня `parts_dry += 1`. После дропа с уровня `parts_dry = 0`. Endless не меняет `parts_dry`.

Открытое оружие: `gun`, `drone` и купленные из `owned_weapons`.

`_profile` добавляет `parts`, `loadout`, `partsDry`.

Маршруты в `server/app.py` рядом с `/chest`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest server.test_store server.test_rewards -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/store.py server/app.py server/test_store.py server/parts_bridge.py server/parts-cli.mjs
git -c user.name="PolySpire Agent" -c user.email="agent@local" commit -m "Store parts and roll them on the server."
```

---

### Task 3: Бой применяет надетые детали

**Files:**
- Modify: `src/game.js` (`startRun`)
- Modify: `test/parts.test.js` или `test/battle.test.js`

**Interfaces:**
- Consumes: `sumBonuses`, `applyBonuses` из `src/parts.js`
- Produces: в начале забега `run` уже с бонусами надетых деталей из `this.profile`

- [ ] **Step 1: Write the failing test**

Собрать headless `Game` с профилем: одна надетая легендарная деталь пулемёта с affix урона step 4 и одна ненадетая с `hp` step 4. После `startRun(1)` `run.gun.dmg` равен `17 * 1.16`, `run.tower.maxHp` равен базовому 220. Ненадетое здоровье не прибавляется.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/parts.test.js`
Expected: FAIL, урон пулемёта остаётся 17

- [ ] **Step 3: Write minimal implementation**

В конце `startRun`, после создания `this.run` и до `queueWave`, вызвать `applyBonuses(this.run, sumBonuses(profile.parts || [], profile.loadout || []))`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game.js test/parts.test.js
git -c user.name="PolySpire Agent" -c user.email="agent@local" commit -m "Apply equipped parts when a run starts."
```

---

### Task 4: Экран инвентаря

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`
- Modify: `src/main.js`
- Modify: `src/api.js`
- Test: `test/api.test.js`

**Interfaces:**
- Consumes: `POST /parts/equip`, `POST /parts/unequip`, поля профиля `parts` и `loadout`, `describeAffix`
- Produces: кнопка «ИНВЕНТАРЬ» в меню, экран `#screen-parts`

- [ ] **Step 1: Write the failing test**

В `test/api.test.js`: `api.equipPart("p1")` шлёт POST `/parts/equip` с `{ partId: "p1" }`. `api.unequipPart(3)` шлёт POST `/parts/unequip` с `{ slot: 3 }`. `api.rollPart({ runId: "r", kind: "level", level: 1 })` шлёт POST `/parts/roll`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/api.test.js`
Expected: FAIL, нет метода

- [ ] **Step 3: Write minimal implementation**

`api.js`: три метода выше.

`index.html`: кнопка в меню после ангара. Экран по образцу ангара: заголовок «ИНВЕНТАРЬ», сетка из восьми кнопок `#parts-slots`, список `#parts-list`, кнопка «НАЗАД».

`main.js`: `screen-parts` в `SCREENS`. Кнопка открывает экран и рисует слоты и склад. Нажатие слота вызывает `unequipPart`. Нажатие строки склада вызывает `equipPart`. Ошибка показывается через `ui.toast`. Редкость красить классами `rarity-common`, `rarity-rare`, `rarity-epic`, `rarity-legendary`.

`style.css`: сетка 4 колонки, редкости цветом текста (обычная белая, редкая голубая, эпическая фиолетовая, легендарная золотая).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add index.html src/style.css src/main.js src/api.js test/api.test.js
git -c user.name="PolySpire Agent" -c user.email="agent@local" commit -m "Add the parts inventory screen."
```

---

### Task 5: Запрос дропа с уровня и из бесконечного режима

**Files:**
- Modify: `src/game.js` (`showLevelClear`, место, где начинается бесконечная волна)
- Modify: `src/main.js` если экран победы рисуется там

**Interfaces:**
- Consumes: `api.rollPart`
- Produces: на экране пройденного уровня строка с основой и редкостью, если деталь выпала. В бесконечном режиме всплывающее сообщение на 5-й, 10-й и дальнейшей волне режима.

- [ ] **Step 1: Write the failing test**

Headless-игра с подменённым `api.rollPart`, который запоминает вызовы и возвращает `{ part: { baseName: "Ствол", rarity: "rare" }, profile: {} }`. `showLevelClear` вызывает roll с `kind: "level"` и номером уровня. Функция пересечения бесконечной волны вызывает roll с `kind: "endless"` только когда число пройденных волн режима кратно 5.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/parts.test.js`
Expected: FAIL, roll не вызван

- [ ] **Step 3: Write minimal implementation**

В `showLevelClear` после показа экрана вызвать `api.rollPart`. Если в ответе есть `part`, дописать строку в экран победы и `applyProfile`. Ошибка сети не ломает экран: молча остаётся без строки.

Считать `endlessWaves` с 1 на первой волне после `beginEndless`. Когда счётчик становится кратен 5, вызвать `rollPart` с этим числом как `wave`. Ответ с деталью показать через `ui.toast`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` и `python3 -m unittest server.test_store -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game.js src/main.js index.html test/parts.test.js
git -c user.name="PolySpire Agent" -c user.email="agent@local" commit -m "Roll a part when a level or endless wave is cleared."
```

---

### Task 6: Выкладка

**Files:**
- Не менять исходники, если тесты зелёные.

- [ ] **Step 1: Прогнать оба набора тестов**

Run: `npm test` и `python3 -m unittest discover -s server -v`
Expected: PASS

- [ ] **Step 2: Собрать и выложить**

`npm run build`. `sshpass -e scp` содержимого `dist/` в `/var/www/roguebullet/` на `root@157.22.230.112`. Туда же `server/*.py`, `server/parts-cli.mjs` и `src/parts.js` в `/var/www/roguebullet-src/`. `systemctl restart roguebullet-api`. Не трогать xray, 443 и 8443.

- [ ] **Step 3: Commit не нужен, если выкладка ничего не меняет в git**
