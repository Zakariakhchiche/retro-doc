import {
  AfterViewInit,
  Directive,
  ElementRef,
  inject,
  input,
  OnChanges,
  output,
} from '@angular/core';
import { RepoFile } from '../core/api';

/** Marks an element this directive turned into an openable file mention. */
export const FILE_REF_CLASS = 'file-ref';

/** A file mention the reader activated. */
export interface FileRefActivation {
  path: string;
  fileId: string;
}

/**
 * Index a repository's files under every name an answer might use for them.
 *
 * Exact repo-root paths are what the prompt asks the model for. A bare
 * basename is also accepted, but only when exactly one file in the repository
 * carries it: a link that opens one of three `Main.java` at random would be
 * worse than leaving the text alone.
 */
export function buildFileIndex(files: readonly RepoFile[]): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  const occurrences = new Map<string, number>();

  for (const file of files) {
    index.set(file.path, file.file_id);
    const name = basename(file.path);
    occurrences.set(name, (occurrences.get(name) ?? 0) + 1);
  }

  for (const file of files) {
    const name = basename(file.path);
    // `!index.has(name)` keeps a real file named exactly like another's
    // basename pointing at itself.
    if (name && occurrences.get(name) === 1 && !index.has(name)) {
      index.set(name, file.file_id);
    }
  }

  return index;
}

/**
 * Resolve a mention written in an answer to a file of the repository.
 *
 * Returns `null` for anything the repository does not have, so prose that
 * merely looks like a path — or an ambiguous basename — stays plain text.
 */
export function resolveFileRef(
  text: string,
  index: ReadonlyMap<string, string>
): FileRefActivation | null {
  const path = normalizeMention(text);
  if (!path) return null;

  const fileId = index.get(path);
  return fileId === undefined ? null : { path, fileId };
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Reduce a mention to the form the index is keyed by. */
function normalizeMention(text: string): string {
  let mention = text.trim();
  try {
    mention = decodeURIComponent(mention);
  } catch {
    // A lone `%` is not an escape sequence; the text is used as written.
  }
  // A link target is often written relative (`./src/Foo.java`) or rooted
  // (`/src/Foo.java`); the index holds neither prefix.
  return mention.replace(/^\.?\//, '');
}

/**
 * Turn repository paths written in a rendered answer into openable mentions.
 *
 * The markup happens after render, on the sanitized DOM, rather than in
 * `MarkdownPipe`: Angular's `[innerHTML]` sanitizer allows no `data-*`
 * attribute, so identifiers emitted by a `marked` renderer would be stripped
 * before they ever reached a listener. Attaching them to the real nodes here
 * sidesteps that — and keeps the pipe free of any trusted-HTML escape hatch.
 */
@Directive({
  selector: '[appFileRefs]',
  host: {
    '(click)': 'onClick($event)',
    '(keydown)': 'onKeydown($event)',
  },
})
export class FileRefsDirective implements AfterViewInit, OnChanges {
  private readonly el = inject(ElementRef<HTMLElement>);

  /**
   * Bind to the *raw* markdown of the message.
   *
   * Only its identity matters — it tells the directive the body changed
   * without paying for a third parse of the same string.
   */
  readonly appFileRefs = input<string>();

  /** Path or unambiguous basename to file id, from `buildFileIndex`. */
  readonly fileIndex = input<ReadonlyMap<string, string>>(new Map<string, string>());

  readonly fileRefClick = output<FileRefActivation>();

  ngAfterViewInit(): void {
    this.markMentions();
  }

  ngOnChanges(): void {
    this.markMentions();
  }

  /**
   * Mark up every mention the rendered body holds.
   *
   * Two shapes are recognised: an inline `<code>` span whose text is a known
   * path, and a link whose target is one. A fenced block is skipped — it is a
   * listing, not a mention — and so is anything already marked, which makes
   * re-running on the next change cheap and idempotent.
   */
  private markMentions(): void {
    const index = this.fileIndex();
    if (index.size === 0) return;

    const container: HTMLElement = this.el.nativeElement;

    for (const node of container.querySelectorAll<HTMLElement>('code, a[href]')) {
      if (node.closest('pre') || node.closest(`.${FILE_REF_CLASS}`)) continue;

      const written = node.tagName === 'A' ? (node.getAttribute('href') ?? '') : node.textContent;
      const ref = resolveFileRef(written ?? '', index);
      if (!ref) continue;

      node.classList.add(FILE_REF_CLASS);
      node.dataset['filePath'] = ref.path;
      node.dataset['fileId'] = ref.fileId;
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      node.setAttribute('title', ref.path);
    }
  }

  protected onClick(event: MouseEvent): void {
    this.activate(event);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    this.activate(event);
  }

  /**
   * Open the mention the event landed on, if any.
   *
   * One delegated listener serves the whole body, so nothing has to be
   * rebound when the message changes.
   */
  private activate(event: Event): void {
    const origin = event.target instanceof Element ? event.target : null;
    const mention = origin?.closest<HTMLElement>(`.${FILE_REF_CLASS}`);
    if (!mention) return;

    // A marked-up link would otherwise navigate, pushing a history entry the
    // conversation does not own, and Space would scroll the transcript.
    event.preventDefault();

    const path = mention.dataset['filePath'];
    const fileId = mention.dataset['fileId'];
    if (path && fileId) {
      this.fileRefClick.emit({ path, fileId });
    }
  }
}
