import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RepoFile } from '../core/api';
import { buildFileIndex, FileRefActivation, FileRefsDirective } from './file-ref.directive';

const FILES: RepoFile[] = [
  { file_id: 'f1', path: 'src/main/java/Foo.java' },
  { file_id: 'f2', path: 'src/main/java/Bar.java' },
  // Two `Main.java` in different packages: the basename is ambiguous.
  { file_id: 'f3', path: 'src/main/java/a/Main.java' },
  { file_id: 'f4', path: 'src/main/java/b/Main.java' },
];

@Component({
  imports: [FileRefsDirective],
  template: `<div
    [innerHTML]="html()"
    [appFileRefs]="html()"
    [fileIndex]="index"
    (fileRefClick)="opened.push($event)"
  ></div>`,
})
class Host {
  readonly html = signal('');
  readonly index = buildFileIndex(FILES);
  readonly opened: FileRefActivation[] = [];
}

describe('buildFileIndex', () => {
  const index = buildFileIndex(FILES);

  it('keys every file by its exact repo path', () => {
    expect(index.get('src/main/java/Foo.java')).toBe('f1');
    expect(index.get('src/main/java/a/Main.java')).toBe('f3');
  });

  it('keys a basename only while it names a single file', () => {
    expect(index.get('Foo.java')).toBe('f1');
    // Opening one of two `Main.java` at random would be worse than no link.
    expect(index.has('Main.java')).toBe(false);
  });
});

describe('FileRefsDirective', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  const render = (html: string): HTMLElement => {
    host.html.set(html);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('marks up a path written in a code span', () => {
    const el = render('See <code>src/main/java/Foo.java</code> for details.');
    const ref = el.querySelector<HTMLElement>('.file-ref');

    expect(ref?.dataset['fileId']).toBe('f1');
    expect(ref?.dataset['filePath']).toBe('src/main/java/Foo.java');
    expect(ref?.getAttribute('role')).toBe('button');
    expect(ref?.getAttribute('tabindex')).toBe('0');
  });

  it('accepts an unambiguous basename but leaves an ambiguous one alone', () => {
    expect(render('<code>Bar.java</code>').querySelector('.file-ref')).not.toBeNull();
    expect(render('<code>Main.java</code>').querySelector('.file-ref')).toBeNull();
  });

  it('leaves a path inside a fenced block alone', () => {
    // A listing quotes paths as data, not as something to open.
    const el = render('<pre><code>cat src/main/java/Foo.java</code></pre>');
    expect(el.querySelector('.file-ref')).toBeNull();
  });

  it('leaves text that is not a file of this repository alone', () => {
    const el = render('<code>npm run build</code> and <code>src/nope.java</code>');
    expect(el.querySelector('.file-ref')).toBeNull();
  });

  it('rewires a markdown link and suppresses its navigation', () => {
    const el = render('<a href="./src/main/java/Bar.java">the parser</a>');
    const ref = el.querySelector<HTMLElement>('.file-ref');
    expect(ref?.dataset['fileId']).toBe('f2');

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    ref!.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(host.opened).toEqual([{ path: 'src/main/java/Bar.java', fileId: 'f2' }]);
  });

  it('opens a mention on click and on Enter', () => {
    const el = render('<code>src/main/java/Foo.java</code>');
    const ref = el.querySelector<HTMLElement>('.file-ref')!;

    ref.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    ref.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    ref.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

    expect(host.opened).toEqual([
      { path: 'src/main/java/Foo.java', fileId: 'f1' },
      { path: 'src/main/java/Foo.java', fileId: 'f1' },
    ]);
  });

  it('marks up the new body when the message changes', () => {
    render('<code>src/main/java/Foo.java</code>');
    const el = render('<code>src/main/java/Bar.java</code>');

    const refs = el.querySelectorAll<HTMLElement>('.file-ref');
    expect(refs.length).toBe(1);
    expect(refs[0].dataset['fileId']).toBe('f2');
  });
});
