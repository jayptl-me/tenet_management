// ── Notice Board ───────────────────────────────────────
export type NoticeTargetType = 'all' | 'floor' | 'room';

export interface INoticePost {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  authorId: string;
  targetType: NoticeTargetType;
  targetIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface INoticePostCreate {
  title: string;
  content: string;
  pinned?: boolean;
  targetType?: NoticeTargetType;
  targetIds?: string[];
}
