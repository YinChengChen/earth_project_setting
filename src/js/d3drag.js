export { dragstarted, dragged, dragend };

// drag 開始、進行中、結束 function
function dragstarted() {
    animation_play = false;
    // cancelAnimationFrame(frame); // 取消動畫
    console.log("start catch");
}

function dragged() {
    console.log("catching");
}

function dragend() {
    console.log("end catch");
}