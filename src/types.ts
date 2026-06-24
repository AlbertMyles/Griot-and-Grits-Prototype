export interface Media {
  id: string;
  title: string;
  filename: string;
  thumbnail: string;
  duration: string;
  resolution: string;
  frame_rate: string;
  transcript: string;
  summary: string;
  created_at: string;
  youtube_id?: string;
  video_url?: string;
  entities?: Entity[];
}

export interface Entity {
  id?: number;
  media_id: string;
  type: 'People' | 'Places' | 'Events' | 'Movements';
  name: string;
  description: string;
}

export interface Stats {
  mediaCount: number;
  entityCount: number;
  placeCount: number;
  eventCount: number;
  recentMedia: Media[];
}

export interface GraphData {
  nodes: { id: string; name: string; type: string }[];
  links: { source: string; target: string }[];
}
