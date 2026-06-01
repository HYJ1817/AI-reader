declare module "epubjs" {
  interface Book {
    renderTo(
      element: HTMLElement,
      options: { width: string; height: string; spread: string }
    ): Rendition;
    destroy(): void;
  }

  interface Rendition {
    display(target?: string): Promise<void>;
    next(): Promise<void>;
    prev(): Promise<void>;
    on(event: string, callback: (...args: unknown[]) => void): void;
    off(event: string, callback: (...args: unknown[]) => void): void;
    destroy(): void;
    themes: {
      override(prop: string, value: string): void;
      register(name: string, css: Record<string, string>): void;
      select(name: string): void;
    };
  }

  export default function ePub(url: string): Book;
}
