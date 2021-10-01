export { zoomstarted, zoomed, zoomend, resizestarted, resizeend };
// zoom 開始、進行中、結束 function
function zoomstarted() {
    console.log("start zoom");
}
function zoomed() {
    console.log("zooming");
}
function zoomend() {
    console.log("end zoom");
}

// size change 開始、結束
function resizestarted() {
    console.log("resize start");
}
function resizeend() {
    console.log("resize end");
}