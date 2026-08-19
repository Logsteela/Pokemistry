/* ============ engine.js : 実数値 / ダメージ / 抽選 / レイド補正 ============ */
(function (g) {
  'use strict';
  var E = {};

  // ---------------------------------------------------------------- 実数値
  // IV31 / EV0 / 性格補正なし
  E.realStat = function (base, lv, isHP) {
    if (isHP) return Math.floor((2 * base + 31) * lv / 100) + lv + 10;
    return Math.floor((2 * base + 31) * lv / 100) + 5;
  };
  E.statsFor = function (p, lv) {
    var b = p.s;
    return [
      E.realStat(b[0], lv, true),
      E.realStat(b[1], lv, false),
      E.realStat(b[2], lv, false),
      E.realStat(b[3], lv, false),
      E.realStat(b[4], lv, false),
      E.realStat(b[5], lv, false)
    ];
  };

  // ---------------------------------------------------------------- ダメージ
  var POWER = 50;
  function pokeRound(x) { return (x - Math.floor(x) > 0.5) ? Math.ceil(x) : Math.floor(x); }

  E.effectiveness = function (atkType, defTypes) {
    var e = 1;
    for (var i = 0; i < defTypes.length; i++) e *= D.chart[atkType][defTypes[i]];
    return e;
  };

  // rand: 85..100 の整数。null なら乱数補正を掛けない（タイプ選択の比較用）
  E.damage = function (atkStats, atkTypeIdx, defStats, defTypes, level, rand) {
    var isPhys = D.phys[atkTypeIdx] === 1;
    var A = isPhys ? atkStats[1] : atkStats[3];
    var Df = isPhys ? defStats[2] : defStats[4];
    var dmg = Math.floor(Math.floor(Math.floor(2 * level / 5 + 2) * POWER * A / Df) / 50) + 2;
    if (rand != null) dmg = Math.floor(dmg * rand / 100);
    dmg = pokeRound(dmg * 1.5);                       // 必ず自分のタイプ = STAB
    var eff = 1;
    for (var i = 0; i < defTypes.length; i++) {
      var m = D.chart[atkTypeIdx][defTypes[i]];
      eff *= m;
      if (m === 2) dmg = dmg * 2;
      else if (m === 0.5) dmg = Math.floor(dmg / 2);
      else if (m === 0) dmg = 0;
    }
    if (eff > 0 && dmg < 1) dmg = 1;
    return { dmg: dmg, eff: eff };
  };

  // 自分の最大2タイプのうち最終ダメージが最大になるものを選ぶ（乱数除外・同値はタイプ1）
  E.chooseType = function (atkTypes, atkStats, defStats, defTypes, level) {
    var best = -1, bestT = atkTypes[0], bestEff = 1;
    for (var i = 0; i < atkTypes.length; i++) {
      var r = E.damage(atkStats, atkTypes[i], defStats, defTypes, level, null);
      if (r.dmg > best) { best = r.dmg; bestT = atkTypes[i]; bestEff = r.eff; }
    }
    return { type: bestT, base: best, eff: bestEff };
  };

  E.attack = function (atk, def, level) {
    // atk/def: {types, stats}
    var sel = E.chooseType(atk.types, atk.stats, def.stats, def.types, level);
    var rand = U.randInt(85, 100);
    var r = E.damage(atk.stats, sel.type, def.stats, def.types, level, rand);
    return { type: sel.type, dmg: r.dmg, eff: r.eff, rand: rand };
  };

  // ---------------------------------------------------------------- 野生出現抽選
  var STAGE_W = [0.96, 0.037, 0.003];

  E.wildCandidates = function (typeIdx) {
    return D.pokemon.filter(function (p) {
      return p.v === 0 && p.fi === 0 && p.t.indexOf(typeIdx) >= 0;
    });
  };
  // お香対象候補：無進化または進化前（=進化段階0）・貴重NO・基本形態・選択タイプ持ち
  E.incenseCandidates = function (typeIdx) {
    return E.wildCandidates(typeIdx).filter(function (p) { return p.st === 0; });
  };

  // 確率分布を返す {list:[poke], prob:[float]}
  E.wildDistribution = function (typeIdx, incenseTargetId) {
    var cands = E.wildCandidates(typeIdx);
    var byStage = [[], [], []];
    cands.forEach(function (p) { byStage[U.clamp(p.st, 0, 2)].push(p); });
    var present = [], wsum = 0;
    for (var s = 0; s < 3; s++) if (byStage[s].length) { present.push(s); wsum += STAGE_W[s]; }
    var list = [], prob = [];
    present.forEach(function (s) {
      var ps = STAGE_W[s] / wsum;
      var arr = byStage[s], tot = 0, w = [];
      arr.forEach(function (p) { var x = Math.sqrt(p.c); w.push(x); tot += x; });
      arr.forEach(function (p, i) { list.push(p); prob.push(ps * w[i] / tot); });
    });
    if (incenseTargetId) {
      var ti = -1;
      for (var i = 0; i < list.length; i++) if (list[i].i === incenseTargetId) { ti = i; break; }
      if (ti >= 0) {
        for (var j = 0; j < prob.length; j++) prob[j] = prob[j] * 0.8;
        prob[ti] = 0.2 + prob[ti];    // 0.2 + 0.8p
      }
    }
    return { list: list, prob: prob };
  };

  E.rollWild = function (dist) {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < dist.list.length; i++) {
      acc += dist.prob[i];
      if (r < acc) return dist.list[i];
    }
    return dist.list[dist.list.length - 1];
  };

  // 捕獲判定：0〜255 の整数乱数 r について r < 被捕獲度 なら成功
  E.tryCatch = function (p) { return U.randInt(0, 255) < p.c; };

  // 重複時のアメ
  E.dupCandy = function (p) { return p.st >= 2 ? 14 : (p.st === 1 ? 6 : 3); };

  // 敵レベル
  E.wildEnemyLevel = function (partyMaxLv) {
    return U.clamp(Math.ceil(partyMaxLv * 0.8), 1, 80);
  };

  // ---------------------------------------------------------------- レイド
  E.RAID_LV = 90;
  E.raidHasBonus = function (p) { return p.ep === 1 || p.sf === 1; };
  E.raidBossStats = function (p) {
    var b = E.statsFor(p, E.RAID_LV);
    var H = b[0] * 100, A = b[1], B = b[2] * 5, C = b[3], Df = b[4] * 5, Sp = b[5];
    if (E.raidHasBonus(p)) { H *= 2; A *= 1.5; B *= 1.5; C *= 1.5; Df *= 1.5; }
    return [Math.floor(H), Math.floor(A), Math.floor(B), Math.floor(C), Math.floor(Df), Math.floor(Sp)];
  };
  E.raidMaxHP = function (p) { return E.raidBossStats(p)[0]; };

  // ---------------------------------------------------------------- 進化 / 強化
  E.candyToLevel = function (from, to) {
    if (to <= from) return 0;
    return (to * (to + 1) - from * (from + 1)) / 2;
  };
  E.maxLevelWith = function (from, candy) {
    var lv = from;
    while (lv < 100 && candy >= lv + 1) { candy -= (lv + 1); lv++; }
    return lv;
  };
  E.evoOptions = function (speciesId) {
    return D.evolutionsFrom(speciesId).map(function (e) {
      return {
        edge: e, to: e.to, toName: D.sp(e.to).name, cost: e.cost,
        owned: S.isOwned(e.to), branch: e.branch
      };
    });
  };

  // ---------------------------------------------------------------- 戦闘用ユニット
  E.makeAlly = function (imageId) {
    var p = D.p(imageId);
    var lv = S.lvOf(p.sp) || 1;
    var st = E.statsFor(p, lv);
    return { id: imageId, p: p, lv: lv, stats: st, types: p.t, hp: st[0], maxhp: st[0] };
  };
  E.makeWildFoe = function (p, lv) {
    var st = E.statsFor(p, lv);
    return { id: p.i, p: p, lv: lv, stats: st, types: p.t, hp: st[0], maxhp: st[0] };
  };
  E.makeRaidBoss = function (p, currentHP) {
    var st = E.raidBossStats(p);
    var hp = (currentHP == null) ? st[0] : U.clamp(currentHP, 0, st[0]);
    return { id: p.i, p: p, lv: E.RAID_LV, stats: st, types: p.t, hp: hp, maxhp: st[0], raid: true };
  };

  g.E = E;
})(window);
