// シューズ点数の試算（ルールは research/scoring-rules.md）
const fs=require('fs');
const src='research/shoe-data-filled-round2-2026-10-30.csv';
const text=fs.readFileSync(src,'utf8').replace(/^\ufeff/,'');
const rows=[];let row=[],cell='',q=false;
for(let i=0;i<text.length;i++){const c=text[i];
 if(q){if(c==='"'&&text[i+1]==='"'){cell+='"';i++}else if(c==='"')q=false;else cell+=c}
 else if(c==='"')q=true;else if(c===','){row.push(cell);cell=''}
 else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell=''}else if(c!=='\r')cell+=c}
const H=rows[0];const D=rows.slice(1).map(r=>Object.fromEntries(H.map((h,i)=>[h,r[i]??''])));
const num=v=>{if(!v)return null;const m=String(v).match(/[\d.]+/g);if(!m)return null;const a=m.map(Number);return a.reduce((x,y)=>x+y)/a.length};
const site=require(process.cwd()+'/data/shoesData.js');const byId=Object.fromEntries(site.map(s=>[s.id,s]));
const dn=(v,t)=>{if(v==null)return null;for(const[l,p]of t)if(v<=l)return p;return null};
const up=(v,t)=>{if(v==null)return null;for(const[l,p]of t)if(v>=l)return p;return null};
const light=w=>dn(w,[[180,5],[200,4.5],[220,4],[240,3.5],[260,3],[280,2.5],[300,2],[9999,1.5]]);
const cush=s=>up(s,[[165,5],[150,4.5],[140,4],[130,3.5],[120,3],[110,2.5],[100,2],[0,1.5]]);
const grip=g=>up(g,[[.75,5],[.65,4.5],[.55,4],[.48,3.5],[.42,3],[.35,2.5],[.25,2],[0,1.5]]);
const wear=w=>dn(w,[[.5,5],[.8,4.5],[1,4],[1.3,3.5],[1.8,3],[3,2.5],[99,2]]);
const heel=h=>up(h,[[100,5],[95,4.5],[90,4],[85,3.5],[80,3],[75,2.5],[0,2]]);
const er=e=>up(e,[[78,5],[74,4.5],[70,4],[65,3.5],[60,3],[55,2.5],[50,2],[0,1.5]]);
const life=w=>dn(w,[[.5,800],[.8,700],[1,600],[1.3,500],[1.8,400],[99,300]]);
const cost=c=>dn(c,[[30,5],[60,4],[90,3],[120,2],[1e9,1]]);
// コスパは性能点から計算するので、性能点の重みには入れない（二重計上を防ぐ）
const W={race:{スピード:30,軽さ:25,安定性:15,クッション:10,履き心地:10,グリップ:5},
 speed:{スピード:30,耐久性:15,軽さ:15,クッション:10,安定性:10,履き心地:10,グリップ:5},
 daily:{クッション:20,安定性:20,耐久性:15,履き心地:15,軽さ:5,スピード:5,グリップ:5}};
// 用途の区分（2026-10-30 確定）。指定がない靴はサイトの用途欄から判定する
const SPEED=new Set(['rebelv4','machx2','primex2strung','magicspeed4','evosl','pacerv2','yogiri','rebelv5','cloudflow4','carbonx3','rivalfly4','cloudboomzone','deviate_nitro_3']);
const DAILY=new Set(['bondix','velocity_nitro_3','velocity_nitro_4','skyflow','rincon4','cloudmonster2','propelv5','noosatri15','mach6','neovista','neovista2']);
const TRAIL=new Set(['geltrabuco13','hierrov8','gelsonoma','voyageNitro3']);
const cat=d=>{if(TRAIL.has(d['シューズID']))return'trail';if(SPEED.has(d['シューズID']))return'speed';if(DAILY.has(d['シューズID']))return'daily';const p=d['サイトの用途'];if(/レース|駅伝|マラソン|スパイク/.test(p))return'race';if(/テンポ|スピード|インターバル/.test(p))return'speed';return'daily'};
const EXCL=new Set(['renewride']); // 別世代の計測値
const OVER={ghost18:{'摩擦係数':'0.57','曲げ剛性(N)':'12.3'},// RTINGS のエネルギーリターンは方式が違うので使わない
 metaspeededge:{'エネルギーリターン前足部(%)':''}};
const out=[];
for(const d0 of D){const id=d0['シューズID'],s=byId[id];const d={...d0,...(OVER[id]||{})};const ex=EXCL.has(id);
 const g=k=>ex?null:num(d[k]);
 const w=g('27cm重量(g)'),wSrc=w!=null?'実測':'サイト値';const wt=w??num(d['サイトの重量(g)']);
 const hw=g('かかとの幅(mm)'),hs=g('ヒール剛性(1-5)');
 const st=hw!=null&&hs!=null?(heel(hw)+hs)/2:null;
 const wd=g('摩耗深度(mm)'),kmRaw=g('想定寿命(km)');const km=kmRaw??life(wd);const kmType=kmRaw!=null?'記載値':(wd!=null?'摩耗から推定':'');
 const price=num(d['現行定価(円)'])??num(d['サイトの価格(円)']);const c=(price&&km)?price/km:null;
 const erF=g('エネルギーリターン前足部(%)');
 const sc={クッション:cush(g('衝撃吸収かかと(SA)')),安定性:st,軽さ:light(wt),コスパ:cost(c),履き心地:s.chartData[4],通気性:g('通気性(1-5)'),
  スピード:erF!=null?er(erF)*.7+light(wt)*.3:null,グリップ:grip(g('摩擦係数')),耐久性:kmRaw!=null?up(kmRaw,[[800,5],[650,4.5],[500,4],[400,3],[300,2.5],[0,2]]):wear(wd)};
 const u=cat(d0);let sw=0,have=0,tw=0;for(const[k,x]of Object.entries(W[u==='trail'?'daily':u])){tw+=x;if(sc[k]!=null){sw+=sc[k]*x;have+=x}}
 const labItems=['クッション','安定性','スピード','グリップ','耐久性'].filter(k=>sc[k]!=null).length;
 out.push({id,name:d0['モデル名'],brand:d0['ブランド'],u,old:s.rating,neu:have?sw/have:null,cover:have/tw,labItems,sc,c,km,kmType,wt,wSrc,hasArticle:fs.existsSync(`articles/${id}/article.html`)});
}
// コスパ＝（性能点−2）÷（価格／1万円）×√（寿命／600km）を、用途の中の順位で点数化する
for(const o of out){o.value=(o.labItems>=4&&o.c)?(o.neu-2)/(o.c*o.km/10000)*Math.sqrt(o.km/600):null;o.price=o.c?o.c*o.km:null;o.sc.コスパ=null}
for(const u of['race','speed','daily']){const l=out.filter(o=>o.u===u&&o.value!=null).sort((a,b)=>b.value-a.value);
 l.forEach((o,i)=>{const p=(i+.5)/l.length;o.sc.コスパ=p<=.1?5:p<=.25?4.5:p<=.45?4:p<=.65?3.5:p<=.8?3:p<=.9?2.5:2})}
const r5=v=>v==null?'':Math.round(v*2)/2;
const OH=['シューズID','ブランド','モデル名','区分','性能点','データ充足%','クッション','安定性','軽さ','スピード','グリップ','耐久性','コスパ','履き心地(主観)','通気性','円/km','寿命の根拠'];
const NM={race:'レース',speed:'スピード',daily:'デイリー',trail:'トレイル'};
const lines=[OH.join(',')];
for(const o of [...out].sort((a,b)=>a.u.localeCompare(b.u)||(b.neu??0)-(a.neu??0))){const x=o.sc;lines.push([o.id,o.brand,'"'+o.name+'"',NM[o.u],o.labItems>=4?o.neu.toFixed(2):'',Math.round(o.cover*100),r5(x.クッション),r5(x.安定性),r5(x.軽さ),r5(x.スピード),r5(x.グリップ),r5(x.耐久性),r5(x.コスパ),x.履き心地,x.通気性??'',o.c?Math.round(o.c):'',o.kmType].join(','))}
const LABELS={クッション:0,安定性:1,軽さ:2,コスパ:3,通気性:6,スピード:7,グリップ:8,耐久性:9};
const scores={};
for(const o of out){const ok=o.labItems>=4;const items={};
 if(ok)for(const[k,i]of Object.entries(LABELS))if(o.sc[k]!=null)items[i]=r5(o.sc[k]);
 scores[o.id]={category:NM[o.u],performance:ok?Number(o.neu.toFixed(2)):null,value:ok&&o.u!=='trail'?o.sc.コスパ:null,items}}
fs.writeFileSync('data/scores.json',JSON.stringify(scores,null,1)+'\n');
fs.writeFileSync('research/score-preview.csv','\ufeff'+lines.join('\r\n')+'\r\n');
// 報告
const scored=out.filter(o=>o.labItems>=4);
console.log('total',out.length,'scored',scored.length,'noData',out.filter(o=>o.labItems===0).map(o=>o.id).join(' '));
console.log('partial',out.filter(o=>o.labItems>0&&o.labItems<4).map(o=>o.id+':'+o.labItems).join(' '));
for(const u of['race','speed','daily']){const l=scored.filter(o=>o.u===u).sort((a,b)=>b.neu-a.neu);console.log('\n'+u,l.length);l.slice(0,8).forEach(o=>console.log(' ',o.name,o.neu.toFixed(2),'old',o.old));console.log('  ...bottom');l.slice(-3).forEach(o=>console.log(' ',o.name,o.neu.toFixed(2),'old',o.old))}
const eight=['adiospro5','cielox1_3','endorphinpro5','alphafly4','endorphinspeed6','novablast6','ghost18','waverider30'];
console.log('\neight');eight.forEach(i=>{const o=out.find(x=>x.id===i);console.log(i,o.u,'old',o.old,'new',o.neu?.toFixed(2),'cov',Math.round(o.cover*100),'lab',o.labItems,JSON.stringify(o.sc),'c',o.c&&Math.round(o.c),o.kmType)});
const pct=(a,p)=>a.sort((x,y)=>x-y)[Math.floor(a.length*p)];
for(const k of['クッション','安定性','軽さ','スピード','グリップ','耐久性','コスパ']){const a=out.map(o=>o.sc[k]).filter(v=>v!=null);const b={};a.forEach(v=>{const r=Math.round(v*2)/2;b[r]=(b[r]||0)+1});console.log(k,a.length,JSON.stringify(b))}
const diff=scored.map(o=>({n:o.name,d:o.neu-o.old})).sort((a,b)=>b.d-a.d);console.log('up',diff.slice(0,6).map(x=>x.n+' +'+x.d.toFixed(2)).join(' / '));console.log('down',diff.slice(-6).map(x=>x.n+' '+x.d.toFixed(2)).join(' / '));
console.log('avgdiff',(diff.reduce((a,x)=>a+x.d,0)/diff.length).toFixed(2));
// 検証
const fw=D.map(d=>[d['ブランド'],num(d['前足部の幅(mm)'])]).filter(x=>x[1]);const by={};fw.forEach(([b,v])=>{(by[b]=by[b]||[]).push(v)});console.log('fwidth',Object.entries(by).map(([b,a])=>b+' '+Math.min(...a)+'-'+Math.max(...a)).join(' | '));
console.log('weightDiff>=15',D.filter(d=>{const a=num(d['27cm重量(g)']),b=num(d['サイトの重量(g)']);return a&&b&&Math.abs(a-b)>=15}).map(d=>d['モデル名']+' '+d['サイトの重量(g)']+'→'+d['27cm重量(g)']).join(' / '));
console.log('HAinAC',D.filter(d=>/HA|Shore/.test(d['備考'])&&d['フォーム硬度(AC)']).length,'stage',D.filter(d=>/stage-4/.test(d['出典URL'])).length,'price filled',D.filter(d=>d['現行定価(円)']).length,'km',D.filter(d=>d['想定寿命(km)']).length,'wear',D.filter(d=>d['摩耗深度(mm)']).length);
console.log('wearOut',D.filter(d=>num(d['摩耗深度(mm)'])>=3).map(d=>d['モデル名']+':'+d['摩耗深度(mm)']).join(' '));
console.log('race list',out.filter(o=>o.u==='race').map(o=>o.name).join(', '));console.log('speed list',out.filter(o=>o.u==='speed').map(o=>o.name).join(', '));
console.log('\n=== COSPA');
for(const u of['race','speed','daily']){const l=out.filter(o=>o.u===u&&o.value!=null).sort((a,b)=>b.value-a.value);console.log(u,l.length);l.slice(0,6).forEach(o=>console.log('  ',o.name,'性能',o.neu.toFixed(2),'¥'+Math.round(o.price),Math.round(o.km)+'km',o.kmType,'v',o.value.toFixed(2),'点',o.sc.コスパ));console.log('   ...');l.slice(-3).forEach(o=>console.log('  ',o.name,'性能',o.neu.toFixed(2),'¥'+Math.round(o.price),Math.round(o.km)+'km','点',o.sc.コスパ))}
console.log('8足');['adiospro5','cielox1_3','endorphinpro5','novablast6','ghost18','waverider30'].forEach(i=>{const o=out.find(x=>x.id===i);const l=out.filter(x=>x.u===o.u&&x.value!=null).sort((a,b)=>b.value-a.value);console.log(' ',o.name,'性能',o.neu.toFixed(2),'コスパ',o.sc.コスパ,'順位',l.indexOf(o)+1+'/'+l.length)});
const a=out.filter(o=>o.value!=null),mean=f=>a.reduce((s,o)=>s+f(o),0)/a.length;const corr=(f,g)=>{const mf=mean(f),mg=mean(g);let n=0,x=0,y=0;for(const o of a){n+=(f(o)-mf)*(g(o)-mg);x+=(f(o)-mf)**2;y+=(g(o)-mg)**2}return (n/Math.sqrt(x*y)).toFixed(2)};
console.log('相関 価値-価格',corr(o=>o.value,o=>o.price),'価値-性能',corr(o=>o.value,o=>o.neu),'価値-寿命',corr(o=>o.value,o=>o.km));
