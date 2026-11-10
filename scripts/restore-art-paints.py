#!/usr/bin/env python3
"""Reimport original Everkinetic paint layers from an offline, pinned source cache.

Maintenance only: normal application builds need neither Python nor the cache.
Source SVGs are fetched separately; this importer never accesses the network.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET

SOURCE_COMMIT = '446bb9a3d0c3beb6b84f7c9d77dfc8af707a2ab6'
COLOR = re.compile(r'^(?:#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|black|white|none|currentColor)$')


def unit_opacity(value):
    result = float(value)
    if not math.isfinite(result) or not 0 <= result <= 1:
        raise ValueError('Invalid source opacity')
    return result


def painted_frame(source):
    root = ET.fromstring(source)
    view_box = root.get('viewBox')
    values = [float(value) for value in (view_box or '').split()]
    if len(values) != 4 or not all(math.isfinite(value) for value in values) or values[2] <= 0 or values[3] <= 0:
        raise ValueError('Source needs a valid declared viewBox')
    paths = []

    def visit(node, inherited):
        tag = node.tag.rsplit('}', 1)[-1]
        if tag in ('title', 'desc', 'metadata'):
            return
        if tag not in ('svg', 'g', 'path'):
            raise ValueError('Unsupported source graphic element: ' + tag)
        if any(node.get(key) is not None for key in ('style', 'transform', 'clip-path', 'mask', 'filter')):
            raise ValueError('Source requires explicit handling of style/transform/clipping')
        paint = dict(inherited)
        for key in ('fill', 'fill-rule', 'fill-opacity', 'stroke'):
            if node.get(key) is not None:
                paint[key] = node.get(key)
        if paint['stroke'] != 'none':
            raise ValueError('Source stroke must be preserved explicitly before import')
        if not COLOR.fullmatch(paint['fill']):
            raise ValueError('Unsupported source fill: ' + paint['fill'])
        if paint['fill-rule'] not in ('evenodd', 'nonzero'):
            raise ValueError('Unsupported source fill rule')
        opacity = unit_opacity(node.get('opacity', '1'))
        if tag != 'path' and opacity != 1:
            raise ValueError('Grouped opacity requires retaining the group compositing boundary')
        if tag == 'path':
            d = node.get('d', '').strip()
            if not d:
                raise ValueError('Source path is empty')
            paths.append({
                'd': d,
                'fill': paint['fill'],
                'fill-rule': paint['fill-rule'],
                'opacity': format(opacity * unit_opacity(paint['fill-opacity']), '.15g'),
            })
        for child in node:
            visit(child, paint)

    visit(root, {'fill': '#000000', 'fill-rule': 'nonzero', 'fill-opacity': '1', 'stroke': 'none'})
    if not paths:
        raise ValueError('Source frame has no painted paths')
    return view_box, paths


def generate(root, sources):
    receipt = json.loads((sources / 'source-fetch-receipt.json').read_text())
    if receipt.get('repository') != 'everkinetic/data' or receipt.get('commit') != SOURCE_COMMIT:
        raise ValueError('Source receipt does not identify the pinned upstream revision')
    receipts = {(row['id'], row['phase']): row for row in receipt['files']}
    art = json.loads((root / 'src/data/art.json').read_text())
    outputs = {}
    for slug, entry in art.items():
        if not entry['src'].startswith('everkinetic'):
            continue
        match = re.search(r'/svg/([0-9a-f]{4})\.svg', entry['url'])
        if not match or not re.fullmatch(r'[a-z0-9-]+', slug):
            raise ValueError('Unrecognized existing art provenance: ' + slug)
        source_id = match.group(1)
        frames = []
        view_box = None
        for phase in ('relaxation', 'tension'):
            row = receipts[(source_id, phase)]
            expected_path = f'src/exercises/{source_id}/{source_id}-{phase}.svg'
            if row['path'] != expected_path:
                raise ValueError('Unexpected source receipt path')
            source = (sources / f'{source_id}-{phase}.svg').read_bytes()
            blob = hashlib.sha1(b'blob ' + str(len(source)).encode() + b'\0' + source).hexdigest()
            if blob != row['sha']:
                raise ValueError('Source bytes do not match the GitHub blob SHA: ' + expected_path)
            current_box, paths = painted_frame(source)
            if view_box is not None and current_box != view_box:
                raise ValueError('Frame viewBoxes differ: ' + source_id)
            view_box = current_box
            frames.append(paths)
        if entry.get('n') != len(frames):
            raise ValueError('Source frame count differs from the existing animation: ' + slug)
        svg = ET.Element('svg', {'xmlns': 'http://www.w3.org/2000/svg', 'viewBox': view_box})
        svg.append(ET.Comment(f' Everkinetic/data {SOURCE_COMMIT}; src/exercises/{source_id}/{source_id}-{{relaxation,tension}}.svg; CC BY-SA 4.0. See ATTRIBUTION.md. '))
        for index, paths in enumerate(frames, 1):
            group = ET.SubElement(svg, 'g', {'data-frame': str(index)})
            for path in paths:
                ET.SubElement(group, 'path', path)
        # Every asset is validated before any output is written.
        outputs[root / 'public/art' / f'{slug}.svg'] = ET.tostring(svg, encoding='unicode') + '\n'
    return outputs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources', type=Path, required=True)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    outputs = generate(args.root.resolve(), args.sources.resolve())
    stale = [str(path) for path, content in outputs.items() if not path.exists() or path.read_text() != content]
    if args.check and stale:
        raise SystemExit('Painted assets are stale: ' + ', '.join(stale))
    if not args.check:
        for path, content in outputs.items():
            path.write_text(content)
    print(json.dumps({'assets': len(outputs), 'sourceCommit': SOURCE_COMMIT, 'check': args.check}))


if __name__ == '__main__':
    main()
