const { existsSync, readdirSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
require('../docs/data.js');
require('../docs/engine.js');

test('Pages contains the entry point and every original image', () => {
  const root = path.join(__dirname,'..','docs');
  for (const name of ['index.html','.nojekyll','style.css','data.js','engine.js','app.js']) {
    assert.ok(existsSync(path.join(root,name)),name);
  }
  assert.deepEqual(
    readdirSync(path.join(root,'assets')).sort(),
    DreamData.artNames.map((_,i)=>String(i+1).padStart(2,'0')+'.jpg'),
  );
});

for (const count of [6,7,8]) {
  test(count + ' seats, private identities, and four complete rounds', () => {
    const seats = Dream.players(count);
    seats[0] = { name:'玩家', bot:false };
    const game = Dream.create(seats,'ming');
    const act = action => assert.equal(Dream.act(game,0,action),undefined);
    assert.equal(new Set(game.seats.map(seat=>seat.role)).size,count);
    assert.equal(Dream.view(game,0).seats.filter(seat=>seat.role).length,1);
    for (let round=0;round<4;round++) {
      act({kind:'ready'});
      act({kind:'narrate',tag:'勇气',story:'守护宝木巴'});
      act({kind:'vote',full:true});
      assert.equal(game.phase,2);
      act({kind:'ready'});
      assert.equal(game.phase,3);
      assert.equal(game.reports.length,round+1);
      act({kind:'ready'});
      assert.equal(game.phase,round===3 ? 4 : 0);
    }
    act(game.seats[0].faith ? {kind:'accuse',targets:[]} : {kind:'ready'});
    assert.equal(game.phase,5);
    assert.ok(DreamData.endings[game.ending]);
    assert.equal(Dream.view(game,0).seats.filter(seat=>seat.role).length,count);
  });
}
