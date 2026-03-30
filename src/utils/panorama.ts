import type { PanoramaNode } from "../types";

export const findNodeById = (
  nodes: PanoramaNode[],
  id: string | undefined,
): PanoramaNode | undefined => {
  if (!id) {
    return undefined;
  }

  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }

    const children = node.children ?? [];
    const found = findNodeById(children, id);
    if (found) {
      return found;
    }
  }

  return undefined;
};

export const firstImageOfNode = (node: PanoramaNode): string | undefined => {
  if (node.coverImage) {
    return node.coverImage;
  }

  if (node.images && node.images.length > 0) {
    return node.images[0].imageUrl;
  }

  for (const child of node.children ?? []) {
    const found = firstImageOfNode(child);
    if (found) {
      return found;
    }
  }

  return undefined;
};
