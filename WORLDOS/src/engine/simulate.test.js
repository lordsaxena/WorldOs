import test from "node:test";
import assert from "node:assert/strict";
import {BASELINE, simulate} from "./simulate.js";
test("identical inputs produce identical results",()=>assert.deepEqual(simulate(BASELINE),simulate({...BASELINE})));
test("baseline is finite and bounded",()=>{const m=simulate(BASELINE); for(const v of Object.values(m)) assert.ok(Number.isFinite(v)); assert.ok(m.congestionIndex>=0&&m.congestionIndex<=100);});
test("more renewable capacity lowers or maintains emissions",()=>assert.ok(simulate({...BASELINE,renewableCapacity:85}).emissionsIndex<=simulate(BASELINE).emissionsIndex));
test("higher population increases water demand",()=>assert.ok(simulate({...BASELINE,population:1200000}).waterDemand>simulate(BASELINE).waterDemand));
