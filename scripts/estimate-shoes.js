// 計測データが足りない靴の予想値（サイトには反映しない。ルールは research/scoring-rules.md）
const fs=require('fs');
const scoresPath=require.resolve(process.cwd()+'/data/scores.json');
const real=JSON.parse(fs.readFileSync(scoresPath,'utf8'));
require.cache[scoresPath]={id:scoresPath,filename:scoresPath,loaded:true,exports:{}}; // 計算済みの点で主観値が上書きされないようにする
const site=require(process.cwd()+'/data/shoesData.js');const byId=Object.fromEntries(site.map(s=>[s.id,s]));
const parse=f=>{const text=fs.readFileSync(f,'utf8').replace(/^﻿/,'');const rows=[];let row=[],cell='',q=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(q){if(c==='"'&&text[i+1]==='"'){cell+='"';i++}else if(c==='"')q=false;else cell+=c}
  else if(c==='"')q=true;else if(c===','){row.push(cell);cell=''}
  else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell=''}else if(c!=='\r')cell+=c}
 return rows.slice(1).filter(r=>r.length>1).map(r=>Object.fromEntries(rows[0].map((h,i)=>[h,r[i]??''])))};
const num=v=>{if(!v)return null;const m=String(v).match(/[\d.]+/g);return m?Number(m[0]):null};
const prev=Object.fromEntries(parse('research/score-preview.csv').map(r=>[r['シューズID'],r]));
const raw=Object.fromEntries(parse('research/shoe-data-filled-round2-2026-10-30.csv').map(r=>[r['シューズID'],r]));
// 世代やモデルを特定できず、予想の土台がない靴
const SKIP={gelsonoma:'世代を特定できない',lyteracer:'世代を特定できない',softrideSeries:'単一モデルを特定できない',renewride:'別世代のデータしかない'};
const W={レース:{スピード:30,軽さ:25,安定性:15,クッション:10,履き心地:10,グリップ:5},
 スピード:{スピード:30,耐久性:15,軽さ:15,クッション:10,安定性:10,履き心地:10,グリップ:5},
 デイリー:{クッション:20,安定性:20,耐久性:15,履き心地:15,軽さ:5,スピード:5,グリップ:5}};
W.トレイル=W.デイリー;
const LAB=['クッション','安定性','スピード','グリップ','耐久性'];
// chartData の並びに対応する主観値
const SUBJ={クッション:0,安定性:1,スピード:7,グリップ:8,耐久性:9};
const shoes=Object.keys(real).filter(id=>prev[id]&&byId[id]).map(id=>{const p=prev[id],s=byId[id];
 const items={};for(const k of[...LAB,'軽さ'])items[k]=p[k]===''?null:Number(p[k]);
 return{id,name:s.name,brand:s.brand,cat:real[id].category,items,comfort:s.chartData[4],subj:s.chartData,
  price:num(raw[id]['現行定価(円)'])??num(raw[id]['サイトの価格(円)'])??s.price??null,
  km:num(raw[id]['想定寿命(km)']),perf:real[id].performance,value:real[id].value}});
const perfOf=(o,it)=>{const w=W[o.cat];let a=0,b=0;for(const[k,x]of Object.entries(w)){const v=k==='履き心地'?o.comfort:it[k];if(v!=null){a+=v*x;b+=x}}return a/b};
// リッジ回帰（小さな線形代数）
const fit=(X,y,l=1)=>{const n=X[0].length;const A=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>X.reduce((s,r)=>s+r[i]*r[j],0)+(i===j&&i>0?l:0)));
 const b=Array.from({length:n},(_,i)=>X.reduce((s,r,t)=>s+r[i]*y[t],0));
 for(let i=0;i<n;i++){let p=i;for(let r=i+1;r<n;r++)if(Math.abs(A[r][i])>Math.abs(A[p][i]))p=r;[A[i],A[p]]=[A[p],A[i]];[b[i],b[p]]=[b[p],b[i]];
  for(let r=i+1;r<n;r++){const f=A[r][i]/A[i][i];for(let c=i;c<n;c++)A[r][c]-=f*A[i][c];b[r]-=f*b[i]}}
 const x=Array(n).fill(0);for(let i=n-1;i>=0;i--){x[i]=(b[i]-A[i].slice(i+1).reduce((s,v,j)=>s+v*x[i+1+j],0))/A[i][i]}return x};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const clip=v=>Math.max(1.5,Math.min(5,v));
const medPrice=[...shoes.map(o=>o.price).filter(Boolean)].sort((a,b)=>a-b)[Math.floor(shoes.length/2)];
const base=o=>[1,o.cat==='レース'?1:0,o.cat==='スピード'?1:0,o.items.軽さ,Math.log((o.price||medPrice)/15000)];
const feats={
 カテゴリ平均:(o)=>[1,o.cat==='レース'?1:0,o.cat==='スピード'?1:0],
 重量と価格:base,
 '重量・価格・主観':(o,k)=>[...base(o),o.subj[SUBJ[k]]]};
const predict=(train,o,k,f)=>{const t=train.filter(x=>x.items[k]!=null);const c=fit(t.map(x=>f(x,k)),t.map(x=>x.items[k]));return clip(dot(c,f(o,k)))};
const road=o=>o.cat!=='トレイル';
const scored=shoes.filter(o=>o.perf!=null);
// 1足ずつ計測値を隠して当て、実際の性能点とのずれを測る
const test={};for(const[name,f]of Object.entries(feats)){const err=[];for(const o of scored.filter(road)){const train=scored.filter(x=>x!==o);const it={軽さ:o.items.軽さ};for(const k of LAB)it[k]=predict(train,o,k,f);err.push({o,e:perfOf(o,it)-o.perf})}
 const a=err.map(x=>Math.abs(x.e)).sort((x,y)=>x-y);test[name]={mae:a.reduce((s,v)=>s+v,0)/a.length,p90:a[Math.floor(a.length*.9)],bias:err.reduce((s,x)=>s+x.e,0)/err.length}}
console.log('検証',scored.filter(road).length,'足',Object.entries(test).map(([k,v])=>`${k} 平均ずれ${v.mae.toFixed(2)} 90%${v.p90.toFixed(2)} 偏り${v.bias.toFixed(2)}`).join(' / '));
const leak=scored.filter(o=>o.items.クッション===o.subj[0]).length;console.log('主観と計測の一致',leak,'/',scored.length);
const f=feats[Object.entries(test).sort((a,b)=>a[1].mae-b[1].mae)[0][0]];console.log('採用',Object.entries(test).sort((a,b)=>a[1].mae-b[1].mae)[0][0]);
const lifeOf=d=>d>=5?800:d>=4.5?700:d>=4?600:d>=3.5?500:d>=3?400:300;
const valOf=(perf,price,km)=>(perf-2)/(price/10000)*Math.sqrt(km/600);
const rate=(cat,v)=>{const l=scored.filter(o=>o.cat===cat&&o.price).map(o=>valOf(o.perf,o.price,o.km??lifeOf(o.items.耐久性??3))).sort((a,b)=>b-a);const i=l.filter(x=>x>v).length;const p=(i+.5)/(l.length+1);return p<=.1?5:p<=.25?4.5:p<=.45?4:p<=.65?3.5:p<=.8?3:p<=.9?2.5:2};
// コスパ点も同じように隠して当てる
{const d=[];for(const o of scored.filter(x=>road(x)&&x.value!=null&&x.price)){const train=scored.filter(x=>x!==o);const it={軽さ:o.items.軽さ};for(const k of LAB)it[k]=predict(train,o,k,f);d.push(Math.abs(rate(o.cat,valOf(perfOf(o,it),o.price,lifeOf(it.耐久性)))-o.value))}
 const c=t=>d.filter(x=>x<=t).length;console.log('コスパ検証',d.length,'足 一致',c(0),'±0.5以内',c(.5),'±1以内',c(1),'平均ずれ',(d.reduce((s,v)=>s+v,0)/d.length).toFixed(2));
 const a=scored.filter(road).map(o=>o.perf),m=a.reduce((s,v)=>s+v,0)/a.length;console.log('性能点の標準偏差',Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length).toFixed(2))}
const out=[];
for(const o of shoes.filter(o=>o.perf==null)){if(SKIP[o.id]){out.push({o,skip:SKIP[o.id]});continue}
 const it={軽さ:o.items.軽さ};const known=[];const guessed=[];
 for(const k of LAB){if(o.items[k]!=null){it[k]=o.items[k];known.push(k)}else{it[k]=predict(scored,o,k,f);guessed.push(k)}}
 const perf=perfOf(o,it);const km=o.km??lifeOf(it.耐久性);
 out.push({o,perf,it,known,guessed,value:o.cat!=='トレイル'&&o.price?rate(o.cat,valOf(perf,o.price,km)):null})}
const order=['レース','スピード','デイリー','トレイル'];
out.sort((a,b)=>order.indexOf(a.o.cat)-order.indexOf(b.o.cat)||(b.perf??-1)-(a.perf??-1));
const r5=v=>v==null?'':(Math.round(v*2)/2).toFixed(1);
const H=['シューズID','ブランド','モデル名','区分','予想性能点','予想コスパ点','クッション','安定性','軽さ','スピード','グリップ','耐久性','履き心地(主観)','計測値のある項目','予想した項目','備考'];
const q=v=>{v=v==null?'':String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const lines=[H.join(',')];
for(const x of out){const o=x.o;if(x.skip){lines.push([o.id,o.brand,o.name,o.cat,'','','','','','','','','','','',x.skip].map(q).join(','));continue}
 lines.push([o.id,o.brand,o.name,o.cat,x.perf.toFixed(1),x.value??'',...['クッション','安定性','軽さ','スピード','グリップ','耐久性'].map(k=>r5(x.it[k])),o.comfort,x.known.join('・'),x.guessed.join('・'),''].map(q).join(','))}
fs.writeFileSync('research/score-estimates.csv','﻿'+lines.join('\r\n')+'\r\n');
// サイトに出すのは予想性能点だけ（コスパ点は誤差が大きいので出さない）
fs.writeFileSync('data/score-estimates.json',JSON.stringify(Object.fromEntries(out.filter(x=>!x.skip).map(x=>[x.o.id,Number(x.perf.toFixed(1))])),null,1)+'\n');
for(const x of out)console.log(x.o.cat,'|',x.o.name,'|',x.skip||`${x.perf.toFixed(1)} コスパ${x.value??'-'} 計測${x.known.length}`);
