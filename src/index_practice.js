import "./scss/all.scss";
import { createApp } from "vue";
import axios from "axios";
import { Legend } from "./js/legend.js";
import * as d3 from "d3";
import { feature } from "topojson";

// 自己的模組
import { setHeight, wind_color_scale_accurate } from "./js/otherTool";
import { dragstarted, dragged, dragend } from "./js/d3drag";
import { zoomstarted, zoomed, zoomend, resizestarted, resizeend } from "./js/d3zoom";
// import { createVertexShader, createFragmentShader, createVertexBuffer, createProgram, createTexture, to_radians} from "./js/webglFunction";
import { createCanvas, initProgram, isPowerOf2 } from "./js/webgl_functions";
import { params, vector_snake, wind_overlay, longlatlist, wind_overlay_data } from "./js/builder";
import { generate_particles, get_radius_and_center, advance_particle } from "./js/particles";

const app = createApp({
    data(){
        return {
            text: "測試",
            mapData: '',
            overlayData: '',
            wind_scale: '',
            vectorOverlay: '',
            // svg 地球基本設定參數
            initial_longitude: 0,
            sphere: {
                type: "Sphere"
            },
            animation_play: false,
            alpha_decay: 0.95, //Determine how fast the the particle's trace decays
            particles_travel: 2000, // T
            number_of_prarticles: 3500, // N
            max_age_of_particles: 35, // MAX_AGE
            // svg 資訊
            earth_svg: {
                svg_element: '',
                width: '',
                height: '',
                projection: '',
            }
        };
    },
    methods:{
        async getMapData(){
            await axios.get("https://unpkg.com/world-atlas@1/world/110m.json").then((response)=>{
                this.mapData = response.data;
            });
        },
        async getOverlayData(url){
            await axios.get(url).then((response)=>{
                this.overlayData = response.data;
            });
        },
        setLegend(){
            // let legend = Legend(d3.scaleSequential([0, 100], d3.interpolateTurbo), {
            //     title: "Temperature (°F)"
            // });
            let legend = Legend(this.wind_scale, {
                title: "Wind Speed (m/s)"
            });
            let legend_svg = d3.select("#legend").attr("width", 400).attr("height", 100);
            legend_svg.node().appendChild(legend);

            // let tmpdata = feature(this.mapData, this.mapData.objects.countries);
            // console.log(tmpdata);

        },
        setWindScale(){
            this.wind_scale = wind_color_scale_accurate();
        },
        setEarthInfo(){
            // 基本 svg 取得與長寬設定
            this.earth_svg.svg_element = d3.select("#earth");
            this.earth_svg.projection = d3.geoOrthographic().precision(0.1).rotate([-this.initial_longitude, 0]);
            this.earth_svg.width = this.earth_svg.svg_element.node().getBoundingClientRect().width;
            this.earth_svg.height = setHeight(this.earth_svg.projection, this.earth_svg.width, this.sphere);
        },
        createEarthSvg(){
            let v0, q0, r0, frame, resize_flag, animation_flag;
            // let animation_play = false;
            // let particles = [];
            // let N = this.number_of_prarticles;
            // 建立新的 svg
            let svg = d3.create("svg").attr('viewBox', [0, 0, this.earth_svg.width, this.earth_svg.height]).attr('fill', 'black').attr('preserveAspectRatio', 'xMinYMid');
            this.earth_svg.projection.fitSize([this.earth_svg.width, this.earth_svg.height], d3.geoGraticule10());
            const path = d3.geoPath(this.earth_svg.projection);
            const graticule = d3.geoGraticule10();
            // contains all elements that are draggable
            // 這邊先把 drag 寫上並包含開始結束動作，但是尚未撰寫動畫 function
            const map = svg.append("g").attr("id", "map").attr("width", this.earth_svg.width).attr("height", this.earth_svg.height)
                .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragend))
                .call(d3.zoom().scaleExtent([200, 1440]).on("start", zoomstarted).on("zoom", zoomed).on("end", zoomend));
            addEventListener('resize', function () {
                if (resize_flag) {
                    // 需要 this 麻?
                    clearTimeout(resize_flag);
                }
                resizestarted();
                resize_flag = setTimeout(() => resizeend(), 100);
            });
            // 地球格線
            map.append("path").attr("class", "graticule").attr("stroke", "#ffffff").attr("stroke-width", 1).attr("d", path(graticule));
            // 繪製地圖
            let land_coastline = feature(this.mapData, this.mapData.objects.countries);
            map.append("path").attr("class", "coastline").attr("stroke", "#ffffff").attr("stroke-width", 1).attr("fill", "none").attr("d", path(land_coastline));
            // Wind Overlay 第一個困難部分
            // 建立 foreignObject，因為 canvas 屬於 xmls 系統，一般 html 不會識別
            const foreignObject = map.append("foreignObject").attr("x", 0).attr("y", 0).attr("width", this.earth_svg.width).attr("height", this.earth_svg.height);
            // 建立 foreignObject 的身體(應該就是畫布的概念) 不要用 style 藥用 attr 設定 css 屬性
            const foreignBody = foreignObject.append("xhtml:body").attr("margin", "0px").attr("padding", "0px").attr("background-color", "none").attr("width", this.earth_svg.width + "px").attr("height", this.earth_svg.height + "px");
            // 添加 canvas 給動畫用 這邊尚未有透明背景，會遮住 map
            const canvas_wind_overlay = createCanvas(this.earth_svg.width, this.earth_svg.height, "canvas-wind-overlay");
            // foreignBody.node().appendChild(canvas_wind_overlay);
            // const canvas_wind_overlay = foreignBody.append("canvas").attr("id", "canvas-wind-overlay").attr("x", 0).attr("y", 0).attr("width", this.earth_svg.width).attr("height", this.earth_svg.height).attr("position", "absolute");
            // 使用 WebGl 重新用柵格投影
            const gl = canvas_wind_overlay.getContext("webgl");
            if (gl === null){
                alert("This browser doesn't support webgl");
                return;
            }
            foreignBody.node().appendChild(gl.canvas);
            const programInfo = initProgram(gl);
            const wind_overlay = this.createVectorOverlay();

            // console.log(typeof(wind_overlay), wind_overlay);

            loadDataToCanvas(wind_overlay.overlay_data); // 劃出 overlay 圖

            function loadDataToCanvas(wind_overlay){
                let overlay_width = 1024;
                let overlay_height = 512;
                let overlay_canvas = createCanvas(overlay_width, overlay_height);
                let ctx = overlay_canvas.getContext("2d");
                let myImageData = new ImageData(wind_overlay, overlay_width, overlay_height);
                createImageBitmap(myImageData).then((result) =>{
                    ctx.drawImage(result, 0, 0, overlay_width, overlay_height);
                    renderOverlay(gl, ctx.canvas, programInfo);
                });
            }
            function renderOverlay(gl, image, programInfo){
                gl.clearColor(0.0, 0.0, 0.0, 1.0); // 設定為全黑
                gl.clearDepth(1.0);                // 清除所有東西
                gl.enable(gl.DEPTH_TEST);          // 可以深度測試開啟
                gl.depthFunc(gl.LEQUAL);           // 近的事物蓋住遠的
                // 在開始前，先初始化畫布
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

                const vertexBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, Float32Array.of(-1, -1, +1, -1, +1, +1, -1, +1), gl.STATIC_DRAW);

                let texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, texture);
                console.log(image.width, image.height);
                if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    // console.log("power 2");
                } else {
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                }
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);

                gl.useProgram(programInfo.shaderProgram);
                gl.enableVertexAttribArray(programInfo.a_vertex);

                var size = 2;          // 2 components per iteration
                var type = gl.FLOAT;   // the data is 32bit floats
                var normalize = false; // don't normalize the data
                var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
                var offset = 0;        // start at the beginning of the buffer
                gl.vertexAttribPointer(
                    programInfo.a_vertex, size, type, normalize, stride, offset
                );

                gl.uniform2f(programInfo.u_translate, gl.canvas.width / 2, gl.canvas.height / 2);
                gl.uniform1f(programInfo.u_scale, gl.canvas.height / 2 - 1);
                let rotate = [0, 0];
                let then = 0;
                // 上層球球與下層地圖一起動有困難，rotate 座標不同的樣子
                // this.earth_svg.projection.rotate(rotate);
                drawScene(rotate);
                // requestAnimationFrame(calculateRotation);
                function calculateRotation(now) {
                    now *= 0.001;
                    let deltaTime = now - then;
                    let rotation = [deltaTime * 1000 * -0.0002 % (2 * Math.PI), Math.sin(deltaTime * 1000 * 0.0001) * 0.5];
                    // this.earth_svg.projection.rotate(rotation);
                    drawScene(rotation);

                    requestAnimationFrame(calculateRotation);
                }

                function drawScene(rotate_angle){
                    gl.uniform2fv(programInfo.u_rotate, rotate_angle);
                    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
                    let primitiveType = gl.TRIANGLE_FAN;
                    gl.drawArrays(primitiveType, 0, 4);
                }
            }

            // Wind Particles 第二個困難部分
            // 加油 !!
            const canvas_wind_particles = createCanvas(this.earth_svg.width, this.earth_svg.height, "canvas-wind-particles");
            let context_wind_particles = canvas_wind_particles.getContext("2d");
            let selfs = this;
            start_wind_animation(selfs, wind_overlay.vector_grid);
            foreignBody.node().appendChild(context_wind_particles.canvas);
            function start_wind_animation(selfs, vector_grid){
                let wait_time, current_frame_rate;
                let particles = [];
                const frame_rate = 30;
                const frame_rate_time = 1000 / frame_rate;
                const radius_and_center = get_radius_and_center(selfs.earth_svg.width, selfs.earth_svg.height);
                particles = generate_particles(particles, selfs.number_of_prarticles, radius_and_center, selfs.earth_svg.width, selfs.earth_svg.height, selfs.earth_svg.projection, selfs.max_age_of_particles);
                // console.log("particles:", particles);
                selfs.animation_play = true;

                function tick(t) {
                    if (!selfs.animation_play) {
                        return;
                    }
                    context_wind_particles.beginPath();
                    context_wind_particles.strokeStyle = 'rgba(210, 210, 210, 0.7)';
                    particles.forEach((p) => advance_particle(p, context_wind_particles, radius_and_center, selfs.max_age_of_particles, selfs.particles_travel, selfs.earth_svg.projection, vector_grid));
                    context_wind_particles.stroke();
                    context_wind_particles.globalAlpha = selfs.alpha_decay;
                    context_wind_particles.globalCompositeOperation = 'copy';
                    context_wind_particles.drawImage(context_wind_particles.canvas, 0, 0);
                    context_wind_particles.globalAlpha = 1.0;
                    context_wind_particles.globalCompositeOperation = "source-over";

                    wait_time = frame_rate_time - (performance.now() - t);

                    animation_flag = setTimeout(() => {
                        frame = requestAnimationFrame(tick);
                    }, wait_time);
                }

                tick(performance.now());
            }


            return svg.node();
        },
        createVectorOverlay(){
            // console.log(this.overlayData);
            // console.log("rawdata:", this.overlayData[0].data);
            const vector_params = params(this.overlayData);
            // const [longlist, latlist] = longlatlist(vector_params);

            const vector_grid = vector_snake(vector_params);
            const [longlist, latlist] = longlatlist(vector_grid);
            // console.log(longlist, latlist);
            // console.log(vector_grid);
            // const overlay_canvas = wind_overlay(vector_grid, longlist, latlist);
            const overlay_data = wind_overlay_data(vector_grid, longlist, latlist);
            // return overlay_data;
            return {
                vector_grid: vector_grid,
                overlay_data: overlay_data,
            };
            // let myDiv = document.getElementById('myDiv');
            // myDiv.appendChild(overlay_canvas);
        }
    },
    //  created(){
    //     const response = await this.getMapData();
    //     this.mapData = response;
    //     this.data_status = true;
    // },
    async mounted(){
        await this.getMapData();
        await this.getOverlayData("current-wind-surface-level-gfs-1.0.json");
        this.setWindScale();
        console.log("vue and earth test");
        this.setLegend();
        this.setEarthInfo();
        let map_svg = this.createEarthSvg();
        this.earth_svg.svg_element.node().append(map_svg);
        // let output_data = this.get_radius_and_center(this.earth_svg.width, this.earth_svg.height);
        // console.log("output:", output_data);


    }
});

app.mount("#app");