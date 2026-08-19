#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""app/img/bg/ と app/img/logo.* を走査して data/assets.json を生成する。
差し替え用画像を置いたあとに実行すると、Service Worker のオフラインキャッシュ対象にもなる。"""
import os, io, json

APP = '/root/work/app'
BG_KEYS = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
           'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
           'raid', 'raid_boost']
EXTS = ['webp', 'png', 'jpg', 'jpeg']

assets = {}
bgdir = os.path.join(APP, 'img', 'bg')
os.makedirs(bgdir, exist_ok=True)
for k in BG_KEYS:
    for e in EXTS:
        rel = 'img/bg/%s.%s' % (k, e)
        if os.path.exists(os.path.join(APP, rel)):
            assets['img/bg/' + k] = rel
            break
for e in ['png', 'webp', 'svg']:
    rel = 'img/logo.' + e
    if os.path.exists(os.path.join(APP, rel)):
        assets['img/logo'] = rel
        break

assets['__complete'] = 1   # この一覧が走査済みであることを示す（余計な404を出さないため）
with io.open(os.path.join(APP, 'data', 'assets.json'), 'w', encoding='utf-8') as f:
    json.dump(assets, f, ensure_ascii=False, indent=1)

found = [k for k in BG_KEYS if ('img/bg/' + k) in assets]
missing = [k for k in BG_KEYS if ('img/bg/' + k) not in assets]
print('背景あり (%d):' % len(found), found)
print('背景なし (%d):' % len(missing), missing)
print('ロゴ:', assets.get('img/logo', 'なし'))
