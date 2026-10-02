// Mouse and pen drag to pan; touch retains native scrolling and pinch zoom.
(function () {
  let drag=null, suppressClickUntil=0;
  document.addEventListener('dragstart',event=>{if(event.target.closest('.map-viewport'))event.preventDefault();});
  document.addEventListener('pointerdown',event=>{
    const viewport=event.target.closest('.map-viewport');
    if(!viewport||event.pointerType==='touch'||event.button!==0)return;
    drag={viewport,id:event.pointerId,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop,moved:false};
  });
  document.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    if(!drag.viewport.isConnected){drag=null;return;}
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved&&Math.hypot(dx,dy)>5){drag.moved=true;drag.viewport.setPointerCapture(event.pointerId);drag.viewport.classList.add('is-panning');}
    if(drag.moved){event.preventDefault();drag.viewport.scrollLeft=drag.left-dx;drag.viewport.scrollTop=drag.top-dy;}
  });
  function end(event){if(!drag||event.pointerId!==drag.id)return;const {viewport,id,moved}=drag;drag=null;viewport.classList.remove('is-panning');if(viewport.hasPointerCapture(id))viewport.releasePointerCapture(id);if(moved)suppressClickUntil=performance.now()+250;}
  document.addEventListener('pointerup',end);
  document.addEventListener('pointercancel',end);
  document.addEventListener('lostpointercapture',end);
  document.addEventListener('click',event=>{if(performance.now()<suppressClickUntil&&event.target.closest('.map-viewport')){event.preventDefault();event.stopImmediatePropagation();}},true);
})();
