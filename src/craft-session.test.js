import test from 'node:test';
import assert from 'node:assert/strict';
import {createCraftSession,remainingSeconds,manifestation,isRuinedStroke} from './craft-session.js';
test('首笔前不计时，到期及后台恢复按期限计算',()=>{const s=createCraftSession();assert.equal(remainingSeconds(s,100),null);s.deadline=35100;assert.equal(remainingSeconds(s,100),35);assert.equal(remainingSeconds(s,40000),0);});
test('显形依赖覆盖与准确，单点不能出宝光',()=>{assert.equal(manifestation({coverage:1,precision:1},{pixels:40,span:8}),'quiet');assert.equal(manifestation({coverage:.3,precision:.8},{pixels:1000,span:100}),'gathering');assert.equal(manifestation({coverage:.6,precision:.8},{pixels:1000,span:100}),'treasure');});
test('小幅失笔不毁纸，大片偏墨与漫墨毁纸',()=>{const a={coverage:.5,precision:.85},b={coverage:.5,precision:.7};assert.equal(isRuinedStroke(a,b,100,0,false),false);assert.equal(isRuinedStroke(a,b,1000,100,false),true);assert.equal(isRuinedStroke(a,b,1000,800,false),false);assert.equal(isRuinedStroke(a,b,100,100,true),true);});
