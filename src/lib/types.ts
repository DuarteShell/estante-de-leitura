export type BookStatus = 'nao_lido' | 'lendo' | 'lido' | 'abandonado' | 'desejo';
export type ReadingStatus = 'lendo' | 'lido' | 'abandonado';
export type ReadingFormat = 'fisico' | 'kindle' | 'audiobook' | 'outro';

export interface Profile {
  id: string;
  username: string;
  is_public: boolean;
  display_name: string;
  site_title: string | null;
  bio: string | null;
  annual_goal: number | null;
  /** enfeites e estilo da estante (null = enfeites automáticos) */
  shelf_decor?: ShelfDecor | null;
}

/** um enfeite colocado na estante */
export interface ShelfDecorItem {
  id: string;
  /** tipo do enfeite (ver catálogo em components/ShelfDecor) */
  kind: string;
  /** variação de cor */
  tone: number;
  /** prateleira (0 = a de cima) */
  row: number;
  /**
   * posição na prateleira: fração dos livros que ficam à esquerda (0 = começo, 1 = fim).
   * Em prateleira sem livros é a posição horizontal (0 a 1).
   */
  pos: number;
  /** espelhado */
  flip?: boolean;
}

export interface ShelfDecor {
  items: ShelfDecorItem[];
  /** madeira da estante */
  wood?: string;
  /** cor e padrão do fundo */
  wall?: string;
  pattern?: string;
  /** varal de luzinhas no alto */
  lights?: 'quente' | 'colorida' | null;
  /** quantas prateleiras no mínimo */
  rows?: number;
}

export interface Book {
  id: string;
  user_id?: string;
  title: string;
  author: string | null;
  isbn: string | null;
  cover_url: string | null;
  genres: string[];
  pages: number | null;
  status: BookStatus;
  owned: boolean;
  current_page: number | null;
  notes: string | null;
  /** saga/série: nome, posição (pode ser 1.5) e total de livros */
  series?: string | null;
  series_index?: number | null;
  series_total?: number | null;
  /** ordem manual na estante (menor = primeiro) */
  shelf_position?: number | null;
  created_at: string;
  updated_at?: string;
}

export interface Reading {
  id: string;
  user_id?: string;
  book_id: string;
  status: ReadingStatus;
  started_at: string | null; // yyyy-mm-dd
  finished_at: string | null;
  year: number | null;
  rating: number | null; // 0–5, passo 0,5
  /** coração: favorito, além da nota */
  favorite?: boolean;
  format: ReadingFormat | null;
  pages_read: number | null;
  review: string | null;
  created_at: string;
}

export interface Quote {
  id: string;
  user_id?: string;
  book_id: string;
  text: string;
  page: number | null;
  created_at: string;
}

export interface LibraryData {
  profile: Profile | null;
  books: Book[];
  readings: Reading[];
  quotes: Quote[];
}

export const STATUS_LABEL: Record<BookStatus, string> = {
  nao_lido: 'Não lido',
  lendo: 'Lendo',
  lido: 'Lido',
  abandonado: 'Abandonado',
  desejo: 'Desejo'
};

export const STATUS_DOT: Record<BookStatus, string> = {
  nao_lido: '#FBF8EF',
  lendo: '#E2B04A',
  lido: '#7FA36B',
  abandonado: '#C46A4A',
  desejo: '#F3DCD2'
};

export const FORMAT_LABEL: Record<ReadingFormat, string> = {
  fisico: 'Físico',
  kindle: 'Kindle / e-book',
  audiobook: 'Audiobook',
  outro: 'Outro'
};

export const FORMAT_SHORT: Record<ReadingFormat, string> = {
  fisico: 'Físico',
  kindle: 'Kindle',
  audiobook: 'Audiobook',
  outro: 'Outro'
};
