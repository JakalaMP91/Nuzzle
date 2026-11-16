export type CommentForActivity = { id: string; author?: string };
export function taskActivity(comments: CommentForActivity[] | undefined, images: string[] | undefined, readIds: string[] | undefined, author: string | null) {
  const seen = new Set(readIds ?? []);
  const list = comments ?? [];
  return { comments: list.length, unread: list.filter((comment) => !seen.has(comment.id) && (!author || comment.author !== author)).length, images: (images ?? []).length };
}
export function mergeReadCommentIds(existing: string[] | undefined, comments: CommentForActivity[]) {
  return Array.from(new Set([...(existing ?? []), ...comments.map((comment) => comment.id)]));
}
