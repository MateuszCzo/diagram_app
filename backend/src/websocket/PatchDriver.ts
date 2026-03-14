import { applyPatch, Operation } from 'fast-json-patch';
import { DiagramType } from '../diagram/diagram.entity';

export interface PatchDriver {
  apply(baseSnapshot: string, pendingPatches: unknown[][]): string;
}

export class JsonPatchDriver implements PatchDriver {
  apply(baseSnapshot: string, pendingPatches: Operation[][]): string {
    console.log(`[JsonPatchDriver] apply — baseSnapshot length: ${baseSnapshot.length}, batches: ${pendingPatches.length}`);

    if (pendingPatches.length === 0) return baseSnapshot;

    const flatOps = pendingPatches.flat();
    console.log(`[JsonPatchDriver] flatOps count: ${flatOps.length}`);
    console.log(`[JsonPatchDriver] first op:`, JSON.stringify(flatOps[0]));

    let doc: Record<string, unknown>;
    try {
      doc = baseSnapshot ? JSON.parse(baseSnapshot) : {};
    } catch {
      console.warn('[JsonPatchDriver] failed to parse baseSnapshot, starting from {}');
      doc = {};
    }

    console.log(`[JsonPatchDriver] doc top-level keys:`, Object.keys(doc));

    for (const op of flatOps) {
      const topKey = op.path.split('/')[1];
      if (topKey && !(topKey in doc)) {
        const secondSegment = op.path.split('/')[2];
        const initialValue = isNaN(Number(secondSegment)) ? {} : [];
        console.log(`[JsonPatchDriver] initializing missing key "${topKey}" as ${Array.isArray(initialValue) ? '[]' : '{}'}`);
        doc[topKey] = initialValue;
      }
    }

    try {
      const { newDocument } = applyPatch(doc, flatOps, false, false);
      const result = JSON.stringify(newDocument);
      console.log(`[JsonPatchDriver] apply success — newSnapshot length: ${result.length}`);
      return result;
    } catch (err) {
      console.error('[JsonPatchDriver] applyPatch failed, keeping base snapshot:', err);
      return baseSnapshot || '{}';
    }
  }
}

export interface XmlReplaceOp {
  value: string;
}

export class SnapshotReplaceDriver implements PatchDriver {
  apply(_baseSnapshot: string, pendingPatches: XmlReplaceOp[][]): string {
    if (pendingPatches.length === 0) return _baseSnapshot;

    const lastBatch = pendingPatches[pendingPatches.length - 1];
    const lastOp    = lastBatch[lastBatch.length - 1];

    if (!lastOp?.value) {
      console.warn('[SnapshotReplaceDriver] patch batch missing value, keeping base snapshot');
      return _baseSnapshot;
    }

    console.log(`[SnapshotReplaceDriver] apply success — newSnapshot length: ${lastOp.value.length}`);
    return lastOp.value;
  }
}

export class XmlPatchDriver extends SnapshotReplaceDriver {}

export function createPatchDriver(type: DiagramType): PatchDriver {
  console.log(`[PatchDriver] createPatchDriver — type: ${type}`);
  switch (type) {
    case DiagramType.EXCALIDRAW: return new SnapshotReplaceDriver();
    case DiagramType.DRAWIO:     return new SnapshotReplaceDriver();
    default:
      throw new Error(`[PatchDriver] unknown diagram type: ${type}`);
  }
}