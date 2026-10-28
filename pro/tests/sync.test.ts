import { strict as assert } from "assert";
import { checkIsSkipItemOrNotByName, detectRemoteMoves } from "../src/sync";
import type { MixedEntity } from "../../src/baseTypes";

describe("Sync: checkIsSkipItemOrNotByName", () => {
  it("should be ok everywhere for empty config", async () => {
    let isSkip = checkIsSkipItemOrNotByName(
      "xxx.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ [],
      /* onlyAllowPaths */ []
    ).finalIsIgnored;
    assert.ok(!isSkip);

    isSkip = checkIsSkipItemOrNotByName(
      "xxx.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ [""],
      /* onlyAllowPaths */ ["", "\n"]
    ).finalIsIgnored;
    assert.ok(!isSkip);
  });

  it("should be ok for deny list", async () => {
    let isSkip = checkIsSkipItemOrNotByName(
      "xxx.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ ["xxx"],
      /* onlyAllowPaths */ []
    ).finalIsIgnored;
    assert.ok(isSkip);

    isSkip = checkIsSkipItemOrNotByName(
      "yyy.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ ["xxx"],
      /* onlyAllowPaths */ []
    ).finalIsIgnored;
    assert.ok(!isSkip);

    isSkip = checkIsSkipItemOrNotByName(
      "xxx.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ ["xxx$"],
      /* onlyAllowPaths */ []
    ).finalIsIgnored;
    assert.ok(!isSkip);

    // if we deny a folder, we have to deny all the sub files
    // TODO: it's soooo hard to do the path resolution in this func with regex,
    //       so we defer the detection to later steps now.
    //       the test here doesn't work.
    // isSkip = checkIsSkipItemOrNotByName(
    //   'xxx/yyy.md',
    //   false,
    //   false,
    //   false,
    //   '.obsidian',
    //   /*    ignorePaths */ ['xxx/$'],
    //   /* onlyAllowPaths */ []
    // ).finalIsIgnored;
    // assert.ok(isSkip);
  });

  it("should be ok for allow list", async () => {
    let isSkip = checkIsSkipItemOrNotByName(
      "xxx.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ [],
      /* onlyAllowPaths */ ["xxx"]
    ).finalIsIgnored;
    assert.ok(!isSkip);

    isSkip = checkIsSkipItemOrNotByName(
      "yyy.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ [""],
      /* onlyAllowPaths */ ["xxx"]
    ).finalIsIgnored;
    assert.ok(isSkip);

    isSkip = checkIsSkipItemOrNotByName(
      "xxx.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ [],
      /* onlyAllowPaths */ ["xxx$"]
    ).finalIsIgnored;
    assert.ok(isSkip);

    // should NOT skip because we allow the sub file AND not deny the folder
    // TODO: it's soooo hard to do the path resolution in this func with regex,
    //       so we defer the detection to later steps now.
    //       the test here doesn't work.
    // isSkip = checkIsSkipItemOrNotByName(
    //   'xxx/',
    //   false,
    //   false,
    //   false,
    //   '.obsidian',
    //   /*    ignorePaths */ [],
    //   /* onlyAllowPaths */ ['xxx/yyy.md']
    // ).finalIsIgnored;
    // assert.ok(!isSkip);
  });

  it("should detect the name by two lists together", async () => {
    // should skip because we ignore the path
    let isSkip = checkIsSkipItemOrNotByName(
      "xxx.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ ["xxx"],
      /* onlyAllowPaths */ ["yyy"]
    ).finalIsIgnored;
    assert.ok(isSkip);

    // should skip because we disallow the whole folder
    isSkip = checkIsSkipItemOrNotByName(
      "xxx/yyy.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ ["xxx"],
      /* onlyAllowPaths */ ["xxx/yyy.md"]
    ).finalIsIgnored;
    assert.ok(isSkip);
  });
});

describe("Sync: detectRemoteMoves", () => {
  it("should detect remote move via Google Drive persistent ID", () => {
    const mappings: Record<string, MixedEntity> = {
      "FolderA/note.md": {
        key: "FolderA/note.md",
        local: { keyRaw: "FolderA/note.md", mtimeCli: 1000, sizeRaw: 50 },
        prevSync: {
          keyRaw: "FolderA/note.md",
          id: "gd-file-id-abc123xyz",
          hash: "md5-hash-1",
          mtimeSvr: 1000,
          sizeEnc: 50,
        },
        remote: undefined,
      },
      "FolderB/note.md": {
        key: "FolderB/note.md",
        local: undefined,
        prevSync: undefined,
        remote: {
          keyRaw: "FolderB/note.md",
          id: "gd-file-id-abc123xyz",
          hash: "md5-hash-1",
          mtimeSvr: 2000,
          sizeEnc: 50,
        },
      },
    };

    detectRemoteMoves(mappings);

    const del = mappings["FolderA/note.md"];
    const cre = mappings["FolderB/note.md"];

    assert.equal(del.decision, "remote_is_moved_source");
    assert.equal(del.change, true);
    assert.equal(del.moveTargetKey, "FolderB/note.md");

    assert.equal(cre.decision, "remote_is_moved_then_rename_local");
    assert.equal(cre.change, true);
    assert.equal(cre.moveSourceKey, "FolderA/note.md");
    assert.deepEqual(cre.prevSync, del.prevSync);
  });

  it("should detect remote move via Hash and Size fallback", () => {
    const mappings: Record<string, MixedEntity> = {
      "OldPath/report.pdf": {
        key: "OldPath/report.pdf",
        local: { keyRaw: "OldPath/report.pdf", mtimeCli: 1000, sizeRaw: 1024 },
        prevSync: {
          keyRaw: "OldPath/report.pdf",
          hash: "sha256-matching-hash",
          mtimeSvr: 1000,
          sizeEnc: 1024,
        },
        remote: undefined,
      },
      "NewPath/report.pdf": {
        key: "NewPath/report.pdf",
        local: undefined,
        prevSync: undefined,
        remote: {
          keyRaw: "NewPath/report.pdf",
          hash: "sha256-matching-hash",
          mtimeSvr: 2000,
          sizeEnc: 1024,
        },
      },
    };

    detectRemoteMoves(mappings);

    const del = mappings["OldPath/report.pdf"];
    const cre = mappings["NewPath/report.pdf"];

    assert.equal(del.decision, "remote_is_moved_source");
    assert.equal(del.change, true);
    assert.equal(del.moveTargetKey, "NewPath/report.pdf");

    assert.equal(cre.decision, "remote_is_moved_then_rename_local");
    assert.equal(cre.change, true);
    assert.equal(cre.moveSourceKey, "OldPath/report.pdf");
  });

  it("should handle remote move when local file does not exist (pull directly to target)", () => {
    const mappings: Record<string, MixedEntity> = {
      "FolderA/note.md": {
        key: "FolderA/note.md",
        local: undefined, // deleted locally already
        prevSync: {
          keyRaw: "FolderA/note.md",
          id: "gd-file-id-999",
          hash: "hash-999",
          mtimeSvr: 1000,
          sizeEnc: 100,
        },
        remote: undefined,
      },
      "FolderB/note.md": {
        key: "FolderB/note.md",
        local: undefined,
        prevSync: undefined,
        remote: {
          keyRaw: "FolderB/note.md",
          id: "gd-file-id-999",
          hash: "hash-999",
          mtimeSvr: 2000,
          sizeEnc: 100,
        },
      },
    };

    detectRemoteMoves(mappings);

    const del = mappings["FolderA/note.md"];
    const cre = mappings["FolderB/note.md"];

    assert.equal(del.decision, "only_history");
    assert.equal(del.change, false);

    assert.equal(cre.decision, "remote_is_created_then_pull");
    assert.equal(cre.change, true);
  });

  it("should not match unrelated creations and deletions", () => {
    const mappings: Record<string, MixedEntity> = {
      "FolderA/note1.md": {
        key: "FolderA/note1.md",
        local: { keyRaw: "FolderA/note1.md" },
        prevSync: {
          keyRaw: "FolderA/note1.md",
          id: "gd-file-id-1",
          hash: "hash-1",
          sizeEnc: 50,
        },
        remote: undefined,
      },
      "FolderB/note2.md": {
        key: "FolderB/note2.md",
        local: undefined,
        prevSync: undefined,
        remote: {
          keyRaw: "FolderB/note2.md",
          id: "gd-file-id-2",
          hash: "hash-2",
          sizeEnc: 80,
        },
      },
    };

    detectRemoteMoves(mappings);

    assert.equal(mappings["FolderA/note1.md"].decision, undefined);
    assert.equal(mappings["FolderB/note2.md"].decision, undefined);
  });

  it("should skip directory keys in move detection", () => {
    const mappings: Record<string, MixedEntity> = {
      "OldFolder/": {
        key: "OldFolder/",
        local: { keyRaw: "OldFolder/" },
        prevSync: { keyRaw: "OldFolder/", id: "dir-1" },
        remote: undefined,
      },
      "NewFolder/": {
        key: "NewFolder/",
        remote: { keyRaw: "NewFolder/", id: "dir-1" },
      },
    };

    detectRemoteMoves(mappings);

    assert.equal(mappings["OldFolder/"].decision, undefined);
    assert.equal(mappings["NewFolder/"].decision, undefined);
  });
});
