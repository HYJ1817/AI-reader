declare module "epubjs" {
  interface DisplayedLocation {
    index: number;
    href: string;
    cfi: string;
    location: number;
    percentage: number;
    displayed: {
      page: number;
      total: number;
    };
  }

  interface Location {
    start: DisplayedLocation;
    end: DisplayedLocation;
    atStart: boolean;
    atEnd: boolean;
  }

  interface Themes {
    override(prop: string, value: string): void;
    register(name: string, css: Record<string, string> | Record<string, Record<string, string>>): void;
    select(name: string): void;
    fontSize(size: string): void;
    font(family: string): void;
  }

  interface Book {
    renderTo(
      element: HTMLElement,
      options: {
        width: string;
        height: string;
        spread?: string;
        flow?: string;
        manager?: string;
        overflow?: string;
      }
    ): Rendition;
    destroy(): void;
    opened?: Promise<unknown>;
    open(input: ArrayBuffer, what?: "binary"): Promise<unknown>;
    loaded?: { navigation?: unknown };
    getRange?: (cfiRange: string) => Range | null | undefined;
  }

  interface Rendition {
    display(target?: string): Promise<void>;
    next(): Promise<void>;
    prev(): Promise<void>;
    on(event: "relocated", callback: (location: Location) => void): void;
    on(event: "selected", callback: (cfiRange: string, contents: Contents) => void): void;
    on(event: string, callback: (...args: unknown[]) => void): void;
    off(event: string, callback: (...args: unknown[]) => void): void;
    destroy(): void;
    themes: Themes;
    flow(flow: string): void;
    resize(width: number, height: number): void;
    reportLocation(): Promise<void>;
    currentLocation(): DisplayedLocation;
    getContents(): Contents;
  }

  interface Contents {
    window?: { getSelection?: () => Selection | null };
    document?: Document;
  }

  export default function ePub(url?: string | ArrayBuffer): Book;
}
