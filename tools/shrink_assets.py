# 给取景器素材瘦身（素材是 Poly Haven 的 CC0 作品，可以随意改）。用法：python tools/shrink_assets.py assets
#   1. 全景图另存一张 2048 宽的预览版，页面先用它出画面
#   2. 胸像贴图另存一套 1k 版 + 一份指向它们的 gltf，同样用于先出画面
#   3. 路灯 / 提灯 / 盆栽 / 猫石像的贴图原地缩到 512（它们在画面里很小，而且多数时候是虚的）
import sys, os, json
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
root = sys.argv[1]
kb = lambda p: os.path.getsize(p) / 1024

# 1. 全景预览
src = os.path.join(root, 'env', 'shanghai_bund.jpg'); dst = os.path.join(root, 'env', 'shanghai_bund_preview.jpg')
Image.open(src).convert('RGB').resize((2048, 1024), Image.LANCZOS).save(dst, quality=80, optimize=True)
print('preview  %.0f KB' % kb(dst))

# 2. 胸像 1k
bdir = os.path.join(root, 'models', 'marble_bust_01')
g = json.load(open(os.path.join(bdir, 'marble_bust_01_2k.gltf'), encoding='utf-8'))
for im in g['images']:
    p2 = os.path.join(bdir, im['uri']); uri1 = im['uri'].replace('_2k.jpg', '_1k.jpg'); p1 = os.path.join(bdir, uri1)
    assert uri1 != im['uri'], im['uri']
    Image.open(p2).convert('RGB').resize((1024, 1024), Image.LANCZOS).save(p1, quality=82, optimize=True)
    print('bust 1k  %.0f KB  %s' % (kb(p1), uri1)); im['uri'] = uri1
json.dump(g, open(os.path.join(bdir, 'marble_bust_01_1k.gltf'), 'w', encoding='utf-8'), separators=(',', ':'))

# 3. 道具贴图缩到 512
total = 0
for mid in ['street_lamp_01', 'Lantern_01', 'potted_plant_02', 'concrete_cat_statue']:
    tdir = os.path.join(root, 'models', mid, 'textures')
    for fn in sorted(os.listdir(tdir)):
        p = os.path.join(tdir, fn); im = Image.open(p)
        if im.size[0] > 512:
            before = kb(p); im.convert('RGB').resize((512, 512), Image.LANCZOS).save(p, quality=84, optimize=True)
            print('prop     %.0f -> %.0f KB  %s/%s' % (before, kb(p), mid, fn))
        total += kb(p)
print('props textures total %.0f KB' % total)
