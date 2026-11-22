#!/usr/bin/env node
// Tối ưu glb cho app: dedup → weld → resample (animation) → prune → meshopt (quantize + EXT_meshopt_compression).
// Không dùng Draco làm mặc định (DRACOLoader từng gây crash bộ nhớ trên trình duyệt di động);
// --draco chỉ xuất thêm bản Draco để GHI SỐ LIỆU so sánh.
//
//   node optimize.mjs --in build/hyrox3d --out build/hyrox3d/opt [--draco] [--report build/hyrox3d/size-report.md]
//
// Cài: (trong scripts/hyrox3d) npm install   (package.json kèm theo)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { gzipSync, brotliCompressSync, constants as zc } from 'node:zlib';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, prune, resample, meshopt, draco } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const IN = opt('--in', 'build/hyrox3d');
const OUT = opt('--out', join(IN, 'opt'));
const REPORT = opt('--report', join(IN, 'size-report.md'));
const WANT_DRACO = args.includes('--draco');
const FILES = ['hyrox_map.glb', 'hyrox_runner.glb'];

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const deps = { 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder };
if (WANT_DRACO) {
  try {
    const draco3d = (await import('draco3dgltf')).default;
    deps['draco3d.encoder'] = await draco3d.createEncoderModule();
    deps['draco3d.decoder'] = await draco3d.createDecoderModule();
  } catch (e) { console.warn('Không nạp được draco3dgltf → bỏ so sánh Draco:', e.message); }
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies(deps);
mkdirSync(OUT, { recursive: true });

const kb = (n) => (n / 1024).toFixed(1);
const sizes = (buf) => ({
  raw: buf.length,
  gz: gzipSync(buf, { level: 9 }).length,
  br: brotliCompressSync(buf, { params: { [zc.BROTLI_PARAM_QUALITY]: 11 } }).length,
});
function stats(doc) {
  const root = doc.getRoot();
  let tris = 0, verts = 0;
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    const idx = p.getIndices(); const pos = p.getAttribute('POSITION');
    tris += idx ? idx.getCount() / 3 : (pos ? pos.getCount() / 3 : 0);
    verts += pos ? pos.getCount() : 0;
  }
  return { tris: Math.round(tris), verts, meshes: root.listMeshes().length, materials: root.listMaterials().length,
    animations: root.listAnimations().map((a) => a.getName()), nodes: root.listNodes().length };
}

const rows = [];
const out = { files: {} };
for (const f of FILES) {
  const src = join(IN, f);
  if (!existsSync(src)) { console.warn('thiếu', src); continue; }
  const before = sizes(readFileSync(src));
  const doc = await io.read(src);
  const s0 = stats(doc);
  const isRunner = f.includes('runner');
  // KHÔNG dùng join/flatten/instance: bản đồ đã gộp theo vật liệu trong Blender và các vòng StatusRing_xx
  // cần là node riêng để app đổi màu từng trạm; nhân vật có skin.
  await doc.transform(
    dedup(),
    weld(),
    ...(isRunner ? [resample()] : []),
    prune({ keepLeaves: true }),   // giữ node rỗng Anchor_* (app dùng làm mốc)
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  const dst = join(OUT, f);
  await io.write(dst, doc);
  const after = sizes(readFileSync(dst));
  // đọc lại để chắc chắn giải nén được
  const back = await io.read(dst);
  const s1 = stats(back);
  const r = { file: f, before, after, stats: s0, statsAfter: s1,
    extensions: back.getRoot().listExtensionsUsed().map((e) => e.extensionName) };
  if (WANT_DRACO && deps['draco3d.encoder']) {
    const d2 = await io.read(src);
    await d2.transform(dedup(), weld(), ...(isRunner ? [resample()] : []), prune({ keepLeaves: true }),
      draco({ method: 'edgebreaker' }));
    const dd = join(OUT, f.replace('.glb', '.draco.glb'));
    await io.write(dd, d2);
    r.draco = sizes(readFileSync(dd));
  }
  out.files[f] = r;
  rows.push(r);
  console.log(`${f}: ${kb(before.raw)} KB → ${kb(after.raw)} KB (gzip ${kb(after.gz)} KB, br ${kb(after.br)} KB)  ` +
    `tam giác ${s1.tris}, clip ${s1.animations.length}`);
}

let md = '## Dung lượng HYROX 3D (trước / sau tối ưu)\n\n';
md += '| File | Gốc (Blender) | gzip gốc | meshopt | meshopt + gzip | meshopt + brotli |' + (WANT_DRACO ? ' Draco | Draco + gzip |' : '') + ' Tam giác | Clip |\n';
md += '|---|---:|---:|---:|---:|---:|' + (WANT_DRACO ? '---:|---:|' : '') + '---:|---:|\n';
for (const r of rows) {
  md += `| ${r.file} | ${kb(r.before.raw)} KB | ${kb(r.before.gz)} KB | ${kb(r.after.raw)} KB | **${kb(r.after.gz)} KB** | ${kb(r.after.br)} KB |` +
    (WANT_DRACO ? (r.draco ? ` ${kb(r.draco.raw)} KB | ${kb(r.draco.gz)} KB |` : ' – | – |') : '') +
    ` ${r.statsAfter.tris} | ${r.statsAfter.animations.length} |\n`;
}
const tot = rows.reduce((a, r) => a + r.after.gz, 0);
md += `\nTổng tải về (meshopt + gzip): **${kb(tot)} KB**. Mục tiêu: map < 150 KB, runner < 120 KB.\n`;
md += `\nExtension: ${[...new Set(rows.flatMap((r) => r.extensions))].join(', ')}\n`;
const fails = rows.filter((r) => (r.file.includes('map') && r.after.gz > 150 * 1024) || (r.file.includes('runner') && r.after.gz > 120 * 1024));
if (fails.length) md += `\n⚠ Vượt mục tiêu: ${fails.map((r) => r.file).join(', ')}\n`;
writeFileSync(REPORT, md);
writeFileSync(join(OUT, 'size-report.json'), JSON.stringify(out, null, 1));
console.log('\n' + md);
