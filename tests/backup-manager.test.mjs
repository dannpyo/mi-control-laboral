import test from "node:test";
import assert from "node:assert/strict";
import {
  createBackupManager,
  supportsDirectoryAccess,
  reminderDue,
  backupDocument,
} from "../js/data/manager.js";
import { defaults, blank } from "../js/modules/domain.js";
import { initialData, upsertShift, removeShift } from "../js/private/domain.js";
import { backupDefaults } from "../js/storage/db.js";
function fixture() {
  const root = { files: new Map(), dirs: new Map() },
    permission = { value: "granted", requests: 0, picks: 0 },
    fault = { write: false, corrupt: false, close: false, gate: null };
  class Dir {
    constructor(name = "Destino", tree = root) {
      this.name = name;
      this.tree = tree;
    }
    async queryPermission() {
      return permission.value;
    }
    async requestPermission() {
      permission.requests++;
      return permission.value;
    }
    async getDirectoryHandle(name, { create = false } = {}) {
      if (!this.tree.dirs.has(name)) {
        if (!create) throw new DOMException("No existe", "NotFoundError");
        this.tree.dirs.set(name, { files: new Map(), dirs: new Map() });
      }
      return new Dir(name, this.tree.dirs.get(name));
    }
    async getFileHandle(name, { create = false } = {}) {
      if (!this.tree.files.has(name)) {
        if (!create) throw new DOMException("No existe", "NotFoundError");
        this.tree.files.set(name, "");
      }
      return new File(this.tree, name);
    }
  }
  class File {
    constructor(tree, name) {
      this.tree = tree;
      this.name = name;
    }
    async getFile() {
      const text = this.tree.files.get(this.name);
      return { text: async () => (fault.corrupt ? "corrupto" : text) };
    }
    async createWritable() {
      let text;
      return {
        write: async (value) => {
          if (fault.write) throw Error("Disco lleno");
          text = value;
          if (fault.gate) await fault.gate;
        },
        close: async () => {
          if (fault.close) throw Error("Cierre fallido");
          this.tree.files.set(this.name, text);
        },
        abort: async () => {},
      };
    }
  }
  const handle = new Dir();
  let prefs = { ...backupDefaults(), handle, enabled: true, groupDaily: false },
    revision = 1,
    rows = [{ ...blank("2026-11-12", "2", defaults()), entry: "07:30" }];
  const config = defaults();
  let privateGuards;
  const db = {
    getBackupSettings: async () => ({ ...prefs }),
    getSnapshot: async () => ({
      records: structuredClone(rows),
      config: structuredClone(config),
      revision,
      backup: { ...prefs },
      privateGuards,
    }),
    updateBackupSettings: async (patch) => (prefs = { ...prefs, ...patch }),
    setBackupDestination: async (h) => {
      prefs = {
        ...prefs,
        handle: h,
        generation: prefs.generation + 1,
        pending: true,
        lastFingerprint: null,
      };
    },
    commitVerifiedBackup: async (info) => {
      if (info.generation !== prefs.generation) return false;
      prefs = {
        ...prefs,
        lastVerifiedAt: info.at,
        lastVerifiedRevision: info.revision,
        lastFilename: info.filename,
        lastFingerprint: info.fingerprint,
        lastDay: info.day,
        pending: revision !== info.revision,
        pausedAfterClear: false,
        error: null,
      };
      return true;
    },
  };
  let chain = Promise.resolve();
  const env = {
    FileSystemDirectoryHandle: Dir,
    FileSystemFileHandle: File,
    showDirectoryPicker: async () => {
      permission.picks++;
      return handle;
    },
    navigator: {
      locks: {
        request: (_name, fn) => {
          const next = chain.then(fn);
          chain = next.catch(() => {});
          return next;
        },
      },
    },
  };
  const manager = createBackupManager({
    db,
    env,
    now: () => new Date("2026-11-12T20:30:00"),
  });
  const allFiles = (tree = root) => [
    ...tree.files.entries(),
    ...[...tree.dirs.values()].flatMap((t) => allFiles(t)),
  ];
  return {
    manager,
    db,
    env,
    handle,
    permission,
    fault,
    allFiles,
    get prefs() {
      return prefs;
    },
    get rows() {
      return rows;
    },
    change() {
      revision++;
      rows[0].exit = "19:30";
    },
    privateOnly(data) {
      rows = [];
      privateGuards = structuredClone(data);
      revision++;
    },
    clear() {
      rows = [];
      revision++;
      prefs = {
        ...prefs,
        generation: prefs.generation + 1,
        pausedAfterClear: true,
        pending: true,
      };
    },
  };
}
test("capacidad, carpeta explícita y permisos; consultar estado/reabrir no solicita permisos", async () => {
  const f = fixture();
  assert.equal(supportsDirectoryAccess(f.env), true);
  assert.equal(supportsDirectoryAccess({}), false);
  await f.manager.status();
  assert.equal(f.permission.requests + f.permission.picks, 0);
  await f.manager.chooseDirectory();
  assert.equal(f.permission.picks, 1);
  f.permission.value = "denied";
  assert.equal((await f.manager.status()).state, "no disponible");
  await assert.rejects(f.manager.chooseDirectory());
  assert.equal(f.permission.requests, 1);
});
test("permiso revocado mantiene pendiente y no escribe ni cambia el registro", async () => {
  const f = fixture();
  f.permission.value = "prompt";
  const old = structuredClone(f.rows);
  assert.equal((await f.manager.createNow()).pending, true);
  assert.equal(f.permission.requests, 0);
  assert.deepEqual(f.rows, old);
  assert.equal(f.allFiles().length, 0);
  assert.equal(f.prefs.pending, true);
});
test("escritura, cierre y verificación JSON compatible sin handle ni metadatos internos", async () => {
  const f = fixture(),
    result = await f.manager.createNow();
  assert.equal(result.verified, true);
  const [name, text] = f.allFiles()[0];
  assert.match(name, /^MiControlLaboral_2026-11-12_203000\.json$/);
  const data = JSON.parse(text);
  assert.equal(data.version, 1);
  assert.equal(data.records[0].entry, "07:30");
  assert.equal("backup" in data, false);
  assert.equal("handle" in data, false);
  assert.equal(f.prefs.pending, false);
  assert.equal((await f.manager.status()).state, "actualizado");
});
test("dos escrituras consecutivas y concurrentes crean nombres únicos; copias anteriores intactas", async () => {
  const f = fixture();
  await f.manager.createNow();
  const first = f.allFiles()[0];
  f.change();
  await Promise.all([f.manager.createNow(), f.manager.createNow()]);
  assert.equal(f.allFiles().length, 3);
  assert.deepEqual(f.allFiles()[0], first);
  assert.equal(new Set(f.allFiles().map(([name]) => name)).size, 3);
});
test("agrupación diaria, solo cambios y archivo previo ausente/corrupto no se sobrescribe", async () => {
  const f = fixture();
  await f.manager.setGrouping(true);
  await f.manager.createNow();
  const first = f.allFiles()[0];
  assert.match(f.prefs.lastFilename, /^MiControlLaboral\/2026-11-12\//);
  const same = await f.manager.createNow();
  assert.equal(same.reused, true);
  assert.equal(f.allFiles().length, 1);
  f.change();
  await f.manager.createNow();
  assert.equal(f.allFiles().length, 2);
  assert.deepEqual(f.allFiles()[0], first);
});
test("errores de escritura, cierre y lectura verificable nunca cambian datos ni última copia válida", async () => {
  for (const kind of ["write", "close", "corrupt"]) {
    const f = fixture();
    await f.manager.createNow();
    const date = f.prefs.lastVerifiedAt,
      copy = f.allFiles()[0],
      rows = structuredClone(f.rows);
    f.change();
    const changed = structuredClone(f.rows);
    f.fault[kind] = true;
    const result = await f.manager.createNow();
    assert.equal(result.pending, true);
    assert.deepEqual(f.rows, changed);
    assert.equal(f.prefs.lastVerifiedAt, date);
    assert.equal(f.prefs.pending, true);
    assert.deepEqual(f.allFiles()[0], copy);
  }
});
test("borrar durante una escritura no publica estado actualizado ni crea copia vacía automática", async () => {
  const f = fixture();
  let release;
  f.fault.gate = new Promise((resolve) => {
    release = resolve;
  });
  const pending = f.manager.createNow();
  await new Promise((r) => setTimeout(r, 10));
  f.clear();
  release();
  await pending;
  assert.equal(f.prefs.pausedAfterClear, true);
  assert.equal(f.prefs.pending, true);
  assert.equal(f.prefs.lastVerifiedAt, null);
  const files = f.allFiles();
  assert.equal(JSON.parse(files[0][1]).records.length, 1);
  await f.manager.createNow();
  assert.equal(f.allFiles().length, files.length);
  assert.equal((await f.manager.status()).state, "pendiente");
});
test("solo una copia manual explícita reanuda después de borrar y conserva archivos anteriores", async () => {
  const f = fixture();
  await f.manager.createNow();
  const first = f.allFiles()[0];
  f.clear();
  await f.manager.createNow();
  assert.equal(f.allFiles().length, 1);
  await f.manager.createNow({ manual: true });
  assert.equal(f.allFiles().length, 2);
  assert.deepEqual(f.allFiles()[0], first);
  assert.equal(f.prefs.pausedAfterClear, false);
  assert.equal(JSON.parse(f.allFiles()[1][1]).records.length, 0);
});
test("sin API hay estado no disponible, recordatorio de siete días y JSON manual compatible", async () => {
  const f = fixture(),
    manager = createBackupManager({ db: f.db, env: {} });
  assert.equal((await manager.status()).state, "no disponible");
  const date = new Date("2026-11-12T12:00:00Z");
  assert.equal(
    reminderDue({ reminderSince: "2026-11-05T12:00:00Z" }, date),
    true,
  );
  assert.equal(
    reminderDue(
      {
        reminderSince: "2026-11-05T12:00:00Z",
        lastVerifiedAt: "2026-11-12T10:00:00Z",
      },
      date,
    ),
    false,
  );
  assert.equal(backupDocument(await f.db.getSnapshot()).records.length, 1);
});

test("archivos ajenos y nombres ya existentes nunca se sobrescriben", async () => {
  const f = fixture();
  f.handle.tree.files.set("documento-personal.txt", "Conservar");
  f.handle.tree.files.set(
    "MiControlLaboral_2026-11-12_203000.json",
    "Archivo anterior",
  );
  const result = await f.manager.createNow();
  assert.equal(result.verified, true);
  assert.equal(f.handle.tree.files.get("documento-personal.txt"), "Conservar");
  assert.equal(
    f.handle.tree.files.get("MiControlLaboral_2026-11-12_203000.json"),
    "Archivo anterior",
  );
  assert.match(result.filename, /_001\.json$/);
});
test("reintentar después de un fallo verifica una copia nueva y conserva la copia válida previa", async () => {
  const f = fixture();
  await f.manager.createNow();
  const first = f.allFiles()[0];
  f.change();
  f.fault.write = true;
  assert.equal((await f.manager.createNow()).pending, true);
  f.fault.write = false;
  assert.equal((await f.manager.createNow()).verified, true);
  assert.deepEqual(f.allFiles()[0], first);
  assert.equal(f.prefs.pending, false);
});
test("deduplicación vuelve a verificar y preserva un archivo alterado por fuera", async () => {
  const f = fixture();
  await f.manager.setGrouping(true);
  await f.manager.createNow();
  const parts = f.prefs.lastFilename.split("/");
  const app = f.handle.tree.dirs.get(parts[0]),
    day = app.dirs.get(parts[1]);
  day.files.set(parts[2], "Alterado externamente");
  const result = await f.manager.createNow();
  assert.equal(result.verified, true);
  assert.equal(day.files.get(parts[2]), "Alterado externamente");
  assert.equal(f.allFiles().length, 2);
});

test("respaldo automático solo privado: verifica JSON, cambios y copias históricas sin jornadas DGVS/HGI", async () => {
  const f = fixture();
  let data = upsertShift(initialData("2026-11-12T12:00"), {
    start: "2026-12-05T19:00",
    end: "2026-12-06T07:00",
  });
  f.privateOnly(data);
  await f.manager.setGrouping(true);
  assert.equal((await f.manager.createNow()).verified, true);
  const first = f.allFiles()[0],
    parsed = JSON.parse(first[1]);
  assert.equal(parsed.records.length, 0);
  assert.deepEqual(parsed.privateGuards, JSON.parse(JSON.stringify(data)));
  assert.equal((await f.manager.createNow()).reused, true);
  data = upsertShift(data, {
    id: data.shifts[0].id,
    start: data.shifts[0].start,
    end: "2026-12-06T08:00",
  });
  f.privateOnly(data);
  assert.equal((await f.manager.createNow()).verified, true);
  assert.equal(f.allFiles().length, 2);
  assert.deepEqual(f.allFiles()[0], first);
  assert.equal(
    JSON.parse(f.allFiles()[1][1]).privateGuards.shifts[0].end,
    "2026-12-06T08:00",
  );
  f.privateOnly(removeShift(data, data.shifts[0].id));
  assert.equal((await f.manager.createNow()).verified, true);
  assert.equal(f.allFiles().length, 3);
  assert.equal(JSON.parse(f.allFiles()[2][1]).privateGuards.shifts.length, 0);
  assert.ok(JSON.parse(f.allFiles()[2][1]).privateGuards.history.length);
});
