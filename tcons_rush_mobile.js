export function runGame(canvas, hudButtons){
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio||1, 2);
  function fit(){
    const w = window.innerWidth;
    const h = Math.max(420, window.innerHeight - 140);
    canvas.style.width = w+'px';
    canvas.style.height = h+'px';
    canvas.width = Math.floor(w*DPR);
    canvas.height = Math.floor(h*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  new ResizeObserver(fit).observe(canvas); fit();

  const cfg = { gravity: 0.9, friction: 0.82, jump:-16, maxVX:6 };
  const world = { w: () => canvas.clientWidth, h: () => canvas.clientHeight };
  const rng = (s=>()=> (2**31-1 & (s=Math.imul(48271,s)))/2147483647 )(1337);

  const groundY = () => world.h() - 60;
  const platforms = [{x:0,y:groundY(),w:4000,h:60}];
  const cheetos = [];
  const spikes = [];

  for (let i=0;i<14;i++){
    const w=120+Math.floor(rng()*120);
    const x=200+i*180+Math.floor(rng()*60);
    const y=groundY()- (80+Math.floor(rng()*240));
    platforms.push({x,y,w,h:18});
    if(rng()>0.3){ const n=1+Math.floor(rng()*3); for(let j=0;j<n;j++) cheetos.push({x:x+16+j*20,y:y-14,r:6}); }
    if(rng()>0.65 && i%2){ const sx=x+w+30; spikes.push({x:sx,y:groundY()-18,w:42,h:18}); }
  }
  const goalX = 2600;

  const P = { x:40, y:groundY()-60, w:28, h:40, vx:0, vy:0, on:false, face:1, hp:100, asleep:false, lastHit:-9999, t:0, camX:0 };
  const keys = {left:false,right:false,up:false};
  let paused=false;

  window.addEventListener('keydown', e=>{
    const k=e.key.toLowerCase();
    if(k==='arrowleft'||k==='a') keys.left=true;
    if(k==='arrowright'||k==='d') keys.right=true;
    if(k==='arrowup'||k==='w'||k==='z') keys.up=true;
    if(k===' ') paused=!paused;
    if(k==='r') restart();
  });
  window.addEventListener('keyup', e=>{
    const k=e.key.toLowerCase();
    if(k==='arrowleft'||k==='a') keys.left=false;
    if(k==='arrowright'||k==='d') keys.right=false;
    if(k==='arrowup'||k==='w'||k==='z') keys.up=false;
  });

  if(hudButtons){
    const {left,right,jump,pause,restartBtn} = hudButtons;
    left.addEventListener('touchstart', e=>{ e.preventDefault(); keys.left=true; }, {passive:false});
    left.addEventListener('touchend', e=>{ e.preventDefault(); keys.left=false; }, {passive:false});
    right.addEventListener('touchstart', e=>{ e.preventDefault(); keys.right=true; }, {passive:false});
    right.addEventListener('touchend', e=>{ e.preventDefault(); keys.right=false; }, {passive:false});
    jump.addEventListener('touchstart', e=>{ e.preventDefault(); keys.up=true; setTimeout(()=>keys.up=false,120); }, {passive:false});
    pause.addEventListener('click', ()=> paused=!paused);
    restartBtn.addEventListener('click', restart);
  }

  function restart(){
    P.x=40; P.y=groundY()-60; P.vx=0; P.vy=0; P.hp=100; P.asleep=false; P.t=0; P.camX=0;
    cheetos.forEach(c=>c.gone=false);
  }
  function aabb(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by; }

  let last=performance.now();
  function loop(now){
    requestAnimationFrame(loop);
    const dt=Math.min(48, now-last); last=now;
    if(!paused && !P.asleep) update(dt);
    render();
  }
  requestAnimationFrame(loop);

  function update(dt){
    P.t+=dt;
    if(keys.left){ P.vx-=0.8; P.face=-1; }
    if(keys.right){ P.vx+=0.8; P.face=1; }
    P.vx*=cfg.friction; P.vx = Math.max(-cfg.maxVX, Math.min(cfg.maxVX, P.vx));
    if(keys.up && P.on){ P.vy=cfg.jump; P.on=false; }
    P.vy += cfg.gravity; if(P.vy>24) P.vy=24;
    P.x += P.vx; P.y += P.vy;

    P.on=false;
    for(const p of platforms){
      if(p.x + p.w < P.x-200 || p.x > P.x+200) continue;
      if(aabb(P.x,P.y,P.w,P.h, p.x,p.y,p.w,p.h)){
        const prevY = P.y - P.vy;
        if(prevY + P.h <= p.y + 4 && P.vy >= 0){
          P.y = p.y - P.h; P.vy=0; P.on=true;
        } else if(prevY >= p.y + p.h - 2){
          P.y = p.y + p.h; P.vy=0.2;
        } else {
          if(P.vx>0) P.x=p.x-P.w-0.01; else P.x=p.x+p.w+0.01; P.vx=0;
        }
      }
    }

    for(const c of cheetos){
      if(c.gone) continue;
      const cx=c.x+6, cy=c.y+6, px=P.x+P.w/2, py=P.y+P.h/2;
      const dx=px-cx, dy=py-cy;
      if(dx*dx+dy*dy<(c.r+10)*(c.r+10)){ c.gone=true; P.hp=Math.min(100,P.hp+20); }
    }

    for(const s of spikes){
      if(aabb(P.x,P.y,P.w,P.h, s.x,s.y,s.w,s.h) && P.t - P.lastHit > 800){
        P.hp -= 12; P.lastHit = P.t; P.vy = -8;
      }
    }
    if(P.hp<=0) P.asleep=true;

    P.camX = Math.max(0, Math.min(P.x - world.w()*0.4, goalX - world.w() + 120));

    if(P.t % 1200 < 18 && P.hp>1) P.hp -= 1;
  }

  function drawCheeto(x,y){
    ctx.save(); ctx.translate(x,y); ctx.rotate(.2);
    const g=ctx.createLinearGradient(0,0,16,8); g.addColorStop(0,'#ff6a00'); g.addColorStop(1,'#ffa53a');
    ctx.fillStyle=g; rounded(0,0,14,8,4); ctx.fill();
    ctx.fillStyle='rgba(180,0,0,.55)'; ctx.fillRect(3,3,2,2); ctx.fillRect(9,2,2,2);
    ctx.restore();
  }
  function rounded(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  function render(){
    ctx.clearRect(0,0,world.w(),world.h());
    ctx.globalAlpha=.25;
    for(let i=0;i<120;i++){ ctx.fillStyle='#fff'; ctx.fillRect((i*170 % (goalX+800))*0.3 - P.camX*0.3 - 200, 40+(i*53%160), 2,2); }
    ctx.globalAlpha=1;

    ctx.save(); ctx.translate(-P.camX,0);
    for(const p of platforms){ ctx.fillStyle='#394357'; ctx.fillRect(p.x,p.y,p.w,p.h); ctx.fillStyle='#212938'; ctx.fillRect(p.x,p.y+p.h-4,p.w,4); }
    for(const s of spikes){ ctx.fillStyle='#ad1d2a'; ctx.beginPath(); const tri=4; for(let i=0; i<s.w/tri; i++){ const bx=s.x+i*tri; ctx.moveTo(bx,s.y+s.h); ctx.lineTo(bx+tri/2,s.y); ctx.lineTo(bx+tri,s.y+s.h);} ctx.fill(); }
    for(const c of cheetos){ if(!c.gone) drawCheeto(c.x,c.y); }
    ctx.fillStyle='#ffd54a'; ctx.fillRect(goalX+20,120,12,260);
    drawPlayer();
    ctx.restore();

    drawHUD();
    if(P.asleep) banner('TCon is hibernating... tap ⟳ to try again');
  }

  function drawPlayer(){
    const x=P.x, y=P.y;
    ctx.fillStyle='#d9d9d9'; ctx.fillRect(x, y+16, P.w, 18);
    ctx.fillStyle='#2c2f48'; ctx.fillRect(x+2, y+34, 10, 6); ctx.fillRect(x+16, y+34, 10, 6);
    ctx.fillStyle='#f1e1d0'; ctx.fillRect(x+6, y, 16, 16);
    ctx.fillStyle='#6b4b36'; ctx.fillRect(x+8, y+10, 12, 6);
    ctx.fillStyle='#0e0e0e';
    if(P.asleep){ ctx.fillRect(x+10,y+6,4,2); ctx.fillRect(x+18,y+6,4,2); }
    else { ctx.fillRect(x+10,y+6,2,2); ctx.fillRect(x+20,y+6,2,2); }
    ctx.fillStyle='#2b2b2b'; ctx.fillRect(x+5,y+2,18,4);
    if(!P.on){ ctx.globalAlpha=.25; ctx.fillStyle='#000'; ctx.fillRect(x,y+P.h+4,P.w,3); ctx.globalAlpha=1; }
  }

  function drawHUD(){
    ctx.fillStyle='rgba(20,24,36,.8)'; ctx.fillRect(12,12,220,60);
    ctx.fillStyle='#b0c7ff'; ctx.font='16px -apple-system, system-ui, Segoe UI'; ctx.fillText('TCon’s Rush', 20, 32);
    ctx.fillStyle='#8993a5'; ctx.fillRect(20, 40, 180, 12);
    const hp=Math.max(0, Math.min(100, P.hp));
    const g=ctx.createLinearGradient(20,0,20+hp*1.8,0); g.addColorStop(0,'#ff6a00'); g.addColorStop(1,'#ffd54a');
    ctx.fillStyle=g; ctx.fillRect(20, 40, hp*1.8, 12);
  }
  function banner(text){
    ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(0,0,world.w(),world.h());
    ctx.fillStyle='#fff'; ctx.font='18px -apple-system, system-ui, Segoe UI'; ctx.textAlign='center';
    ctx.fillText(text, world.w()/2, world.h()/2); ctx.textAlign='left';
  }
}