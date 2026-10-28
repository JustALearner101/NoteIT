import { describe, expect, it } from 'vitest'
import { sanitizeSvg } from './svg-sanitize'

const VALID_SVG = [
  '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="180pt" height="116pt" viewBox="0.00 0.00 180.00 116.00" class="graph">',
  '<g id="graph0" class="graph" transform="scale(1 1) rotate(0) translate(4 112)">',
  '<title>G</title>',
  '<polygon fill="white" stroke="none" points="-4,4 -4,-112 176,-112 176,4 -4,4"/>',
  '<path fill="none" stroke="black" d="M27,-18C27,-18 27,-18 27,-18"/>',
  '<text text-anchor="middle" font-family="Times,serif" font-size="14.00">A</text>',
  '<marker id="arrow" marker-end="url(#arrow)"/>',
  '</g>',
  '</svg>'
].join('\n')

describe('sanitizeSvg', () => {
  it('mengembalikan SVG valid byte-identik', () => {
    expect(sanitizeSvg(VALID_SVG)).toBe(VALID_SVG)
  })

  it('mengembalikan string tanpa tag apa adanya', () => {
    const plain = 'bukan svg, hanya teks biasa dengan < dan > yang tidak lengkap'
    expect(sanitizeSvg(plain)).toBe(plain)
  })

  it('mengembalikan string kosong apa adanya', () => {
    expect(sanitizeSvg('')).toBe('')
  })

  it('menghapus elemen script inline beserta isinya', () => {
    const dirty = '<svg><script>alert("xss")</script><circle r="4"/></svg>'
    const clean = sanitizeSvg(dirty)
    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('alert')
    expect(clean).toContain('<circle r="4"/>')
  })

  it('menghapus atribut event handler onload/onclick', () => {
    const dirty = '<svg onload="alert(1)"><g onclick=\'steal()\'><path d="M0 0"/></g></svg>'
    const clean = sanitizeSvg(dirty)
    expect(clean).not.toContain('onload')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('alert')
    expect(clean).toContain('<path d="M0 0"/>')
  })

  it('menghapus href dan xlink:href berskema javascript:', () => {
    const dirty = '<svg><a href="javascript:alert(1)"><text>x</text></a><use xlink:href=" JavaScript:alert(2)"/></svg>'
    const clean = sanitizeSvg(dirty)
    expect(clean).not.toContain('javascript:')
    expect(clean).not.toContain('JavaScript:')
    expect(clean).toContain('<text>x</text>')
  })

  it('mempertahankan href yang sah (fragment / url(#id))', () => {
    const safe = '<svg><use xlink:href="#arrow"/><path fill="url(#grad)"/></svg>'
    expect(sanitizeSvg(safe)).toBe(safe)
  })

  it('membuang seluruh elemen foreignObject', () => {
    const dirty =
      '<svg><foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">html</div></foreignObject><circle r="1"/></svg>'
    const clean = sanitizeSvg(dirty)
    expect(clean).not.toContain('foreignObject')
    expect(clean).not.toContain('<div')
    expect(clean).toContain('<circle r="1"/>')
  })

  it('mempertahankan atribut sah: viewBox, style, transform, font-*, marker-*', () => {
    const svg =
      '<svg viewBox="0 0 10 10"><g style="fill:red" transform="translate(1 2)"><text font-family="mono" font-size="12" marker-end="url(#a)">t</text></g></svg>'
    expect(sanitizeSvg(svg)).toBe(svg)
  })

  it('tidak menyisakan tag script yatim tanpa penutup', () => {
    const clean = sanitizeSvg('<svg><script>alert(1)</svg>')
    expect(clean).not.toContain('<script')
  })
})
