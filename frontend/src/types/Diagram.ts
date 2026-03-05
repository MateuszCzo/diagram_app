export type DiagramType = 'excalidraw' | 'drawio';

export interface Diagram {
  id:          string;
  title:       string;
  description: string | null;
  type:        DiagramType;
  snapshot:    string;
  createdAt:   string;
  updatedAt:   string;
}

export interface CreateDiagramDto {
  title:       string;
  description?: string;
  type:        DiagramType;
  snapshot?:   string;
}

export interface UpdateDiagramDto {
  title?:       string;
  description?: string;
}

export type JsonPatchOp = {
  op:    'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path:  string;
  value?: unknown;
  from?:  string;
};

export type XmlReplaceOp = { value: string };

export type PatchOp = JsonPatchOp | XmlReplaceOp;

export type ServerMessage =
  | { type: 'DIAGRAM_INIT';  snapshot: string; pendingPatches: PatchOp[][] }
  | { type: 'DIAGRAM_PATCH'; ops: PatchOp[] }
  | { type: 'ERROR';         code: string; message: string };

export type ClientMessage =
  | { type: 'DIAGRAM_PATCH'; ops: PatchOp[] };