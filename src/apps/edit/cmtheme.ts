import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { MONO, PHOSPHOR as P } from '../../theme'

export const phosphorTheme = [
  EditorView.theme({
    '&': { color: P.fg, backgroundColor: P.bg, height: '100%', fontSize: '14px' },
    '.cm-scroller': { fontFamily: MONO },
    '.cm-content': { caretColor: P.bright },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: P.bright },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: P.sel },
    '.cm-gutters': { backgroundColor: P.bg, color: P.dim, border: 'none', borderRight: `1px solid ${P.line}` },
    '.cm-activeLine': { backgroundColor: '#0c1a12' },
    '.cm-activeLineGutter': { backgroundColor: '#0c1a12', color: P.fg },
    '.cm-panels': { backgroundColor: P.panel, color: P.fg },
    '.cm-panels.cm-panels-bottom': { borderTop: `1px solid ${P.line}` },
    '.cm-searchMatch': { backgroundColor: '#2a5a1a' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: '#4a7a1a' },
    '.cm-tooltip': { backgroundColor: P.panel, border: `1px solid ${P.line}` },
    '.cm-matchingBracket': { color: P.bright, outline: `1px solid ${P.dim}` },
  }, { dark: true }),
  syntaxHighlighting(HighlightStyle.define([
    { tag: [t.keyword, t.operatorKeyword, t.modifier], color: P.hot },
    { tag: [t.string, t.special(t.string), t.regexp], color: P.amber },
    { tag: t.comment, color: P.dim, fontStyle: 'italic' },
    { tag: [t.number, t.bool, t.null, t.atom], color: P.cyan },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: P.bright },
    { tag: [t.typeName, t.className, t.namespace], color: P.cyan },
    { tag: t.heading, color: P.bright, fontWeight: 'bold' },
    { tag: [t.link, t.url], color: P.cyan, textDecoration: 'underline' },
    { tag: t.invalid, color: P.red },
  ])),
]
