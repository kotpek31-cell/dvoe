import { registerServiceWorker } from './webPush';

// Веб-версия: мета-теги, чтобы сайт можно было установить на экран «Домой»
// (iPhone: Safari → «Поделиться» → «На экран Домой») и он открывался без адресной строки.
type Doc = {
  head: { appendChild(node: unknown): void; querySelector(selector: string): unknown };
  body: { style: Record<string, string> };
  documentElement: { style: Record<string, string> };
  createElement(tag: string): { setAttribute(name: string, value: string): void };
  title: string;
};

function addTag(doc: Doc, tag: 'meta' | 'link', attrs: Record<string, string>) {
  const key = tag === 'meta' ? `meta[name="${attrs.name}"]` : `link[rel="${attrs.rel}"]`;
  if (doc.head.querySelector(key)) return;
  const el = doc.createElement(tag);
  Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value));
  doc.head.appendChild(el);
}

export function setupWebApp(): void {
  const doc = (globalThis as unknown as { document?: Doc }).document;
  if (!doc) return;
  doc.title = 'Двое';
  doc.body.style.backgroundColor = '#0B0A14';
  doc.documentElement.style.backgroundColor = '#0B0A14';
  // Относительные пути работают и при размещении сайта в подпапке (GitHub Pages)
  addTag(doc, 'link', { rel: 'manifest', href: 'manifest.json' });
  addTag(doc, 'link', { rel: 'apple-touch-icon', href: 'apple-touch-icon.png' });
  addTag(doc, 'meta', { name: 'theme-color', content: '#0B0A14' });
  addTag(doc, 'meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  addTag(doc, 'meta', { name: 'mobile-web-app-capable', content: 'yes' });
  addTag(doc, 'meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' });
  addTag(doc, 'meta', { name: 'apple-mobile-web-app-title', content: 'Двое' });
  // service worker нужен для push-уведомлений на iPhone
  registerServiceWorker();
}
