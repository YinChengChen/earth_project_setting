import "./scss/all.scss";
import { createApp } from "vue";
import axios from "axios";
import { Legend } from "./js/legend.js";
import * as d3 from "d3";
import { feature } from "topojson";
import { versor } from "./js/versor";



// 自己的模組
import { setHeight, wind_color_scale_accurate } from "./js/otherTool";
// import { dragstarted, dragged, dragend } from "./js/d3drag";
import { zoomstarted, zoomed, zoomend, resizestarted, resizeend } from "./js/d3zoom";
// import { createVertexShader, createFragmentShader, createVertexBuffer, createProgram, createTexture, to_radians} from "./js/webglFunction";
import { createCanvas, initProgram, renderOverlay, drawScene, to_radians } from "./js/webgl_functions";
import { params, vector_snake, longlatlist, wind_overlay_data } from "./js/builder";
import { generate_particles, get_radius_and_center, advance_particle } from "./js/particles";

const app = createApp({
    data(){
        return {
            text: "測試",
            mapData: '',
            overlayData: '',
            wind_scale: '',
            vectorOverlay: '',
            earth_speed: 5,
            isRotate: true,
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
                path: '',
            },
            // map 資訊
            map_svg:{
                map_element: '',
                foreign_element: '',
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
            this.earth_svg.path = d3.geoPath(this.earth_svg.projection);
            this.map_svg.map_element = d3.create("svg").attr('viewBox', [0, 0, this.earth_svg.width, this.earth_svg.height]).attr('fill', 'black').attr('preserveAspectRatio', 'xMinYMid');
        },
        async createEarthSvg(){
            let v0, q0, r0, frame, resize_flag, animation_flag, current_rotation;
            // 建立新的 svg
            // let svg = d3.create("svg").attr('viewBox', [0, 0, this.earth_svg.width, this.earth_svg.height]).attr('fill', 'black').attr('preserveAspectRatio', 'xMinYMid');
            let svg = this.map_svg.map_element;
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
            map.append("path").datum(graticule).attr("class", "graticule").attr("d", this.earth_svg.path).style("stroke", "#ffffff").attr("stroke-width", 1);
            // map.append("path").attr("class", "graticule").attr("stroke", "#ffffff").attr("stroke-width", 1).attr("d", path(graticule));
            // 繪製地圖
            let land_coastline = feature(this.mapData, this.mapData.objects.countries);
            map.selectAll(".coastline").data(land_coastline.features).enter().append("path").attr("class", "coastline").attr("d", this.earth_svg.path).style("stroke", "#ffffff").attr("stroke-width", 1).attr("fill", "none");
            // map.append("path").attr("class", "coastline").attr("stroke", "#ffffff").attr("stroke-width", 1).attr("fill", "none").attr("d", path(land_coastline));
            // Wind Overlay 第一個困難部分
            // 建立 foreignObject，因為 canvas 屬於 xmls 系統，一般 html 不會識別
            const foreignObject = map.append("foreignObject").attr("x", 0).attr("y", 0).attr("width", this.earth_svg.width).attr("height", this.earth_svg.height);
            // 建立 foreignObject 的身體(應該就是畫布的概念) 不要用 style 藥用 attr 設定 css 屬性
            const foreignBody = foreignObject.append("xhtml:body").attr("margin", "0px").attr("padding", "0px").attr("background-color", "none").attr("width", this.earth_svg.width + "px").attr("height", this.earth_svg.height + "px");
            // 添加 canvas 給動畫用 這邊尚未有透明背景，會遮住 map
            const canvas_wind_overlay = createCanvas(this.earth_svg.width, this.earth_svg.height, "canvas-wind-overlay");
            // 使用 WebGl 重新用柵格投影
            const gl = canvas_wind_overlay.getContext("webgl");
            if (gl === null){
                alert("This browser doesn't support webgl");
                return;
            }
            foreignBody.node().appendChild(gl.canvas);
            const programInfo = initProgram(gl);
            const wind_overlay = this.createVectorOverlay();

            await this.loadDataToCanvas(wind_overlay.overlay_data); // 劃出 overlay 圖
            renderOverlay(gl, this.vectorOverlay, programInfo);
            let rotate = [0, 0];
            drawScene(gl, programInfo, rotate);

            const canvas_wind_particles = createCanvas(this.earth_svg.width, this.earth_svg.height, "canvas-wind-particles");
            let context_wind_particles = canvas_wind_particles.getContext("2d");
            let selfs = this;

            // Wind Particles 第二個困難部分
            foreignBody.node().appendChild(context_wind_particles.canvas);
            start_wind_animation(selfs, wind_overlay.vector_grid, context_wind_particles);

            // 自轉地球
            this.rotation_animatation(gl, programInfo, map, frame);
            // let earth_rotation = d3.timer((elasped) => {
            //     let new_earth_rotaing = [this.earth_rotating[0] + elasped * this.earth_speed / 1000, this.earth_rotating[1], this.earth_rotating[2]];
            //     this.svg_element.projection.rotate(new_earth_rotaing);
            //     this.svg_element.svg.selectAll("path").attr("d", this.svg_element.path);
            //     if (!this.isRotate) {
            //         this.earth_rotating = new_earth_rotaing;
            //         earth_rotation.stop();
            //     }
            // });

            // 滑鼠移動 function (目前不知道怎麼拆出去)

            function dragstarted() {
                selfs.animation_play = false;
                // cancelAnimationFrame(frame); // 取消動畫 這個沒有好像不影響 ? 效能嗎?
                context_wind_particles.clearRect(0, 0, selfs.earth_svg.width, selfs.earth_svg.height);
                // v0 = cartesian(selfs.earth_svg.projection.invert([event.x, event.y]));
                // console.log(d3.x, d3.y);
                v0 = versor.cartesian(selfs.earth_svg.projection.invert([event.x, event.y]));
                q0 = versor(r0 = selfs.earth_svg.projection.rotate());
                // console.log("v0", v0);
                // console.log("q0", q0);
                // q0 = versor(r0 = selfs.earth_svg.projection.rotate());
                // console.log(v0, q0);

                // console.log("start catch");
            }

            function dragged() {
                selfs.animation_play = false;
                // cancelAnimationFrame(frame); // 取消動畫 這個沒有好像不影響 ? 效能嗎?
                const v1 = versor.cartesian(selfs.earth_svg.projection.rotate(r0).invert([event.x, event.y]));
                const q1 = versor.multiply(q0, versor.delta(v0, v1));
                //shift_vector = Euler rotation angles [λ, φ, γ]. Always keep γ = 0 for clarity
                const shift_vector = versor.rotation(q1);
                const shift_vector_adjusted = [shift_vector[0], shift_vector[1], 0];

                selfs.earth_svg.projection.rotate(shift_vector_adjusted);
                current_rotation = selfs.earth_svg.projection.rotate().map(x => to_radians(x));
                drawScene(gl, programInfo, [current_rotation[0], current_rotation[1]]);

                map.selectAll(".coastline").attr("d", selfs.earth_svg.path);
                map.selectAll(".graticule").attr("d", selfs.earth_svg.path);
            }

            function dragend() {
                current_rotation = selfs.earth_svg.projection.rotate().map(x => to_radians(x));
                drawScene(gl, programInfo, [current_rotation[0], current_rotation[1]]);
                map.selectAll(".coastline").attr("d", path(land_coastline));
                start_wind_animation(selfs, wind_overlay.vector_grid, context_wind_particles);
                // selfs.animation_play = true;
                // console.log("end catch");
            }

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
            const vector_params = params(this.overlayData);
            const vector_grid = vector_snake(vector_params);
            const [longlist, latlist] = longlatlist(vector_grid);
            const overlay_data = wind_overlay_data(vector_grid, longlist, latlist);

            return {
                vector_grid: vector_grid,
                overlay_data: overlay_data,
            };
        },
        async loadDataToCanvas(wind_overlay){
            let overlay_width = 1024;
            let overlay_height = 512;
            let overlay_canvas = createCanvas(overlay_width, overlay_height);
            let ctx = overlay_canvas.getContext("2d");
            let myImageData = new ImageData(wind_overlay, overlay_width, overlay_height);
            await createImageBitmap(myImageData).then((result) => {
                ctx.drawImage(result, 0, 0, overlay_width, overlay_height);
                this.vectorOverlay = ctx.canvas;
            });
        },
        rotation_animatation(gl, programInfo, map, frame){
            let earth_rotation = d3.timer((elasped) => {
                this.animation_play = false;
                cancelAnimationFrame(frame);
                let new_earth_rotaing = [0 + elasped * this.earth_speed / 2000, 0 , 0];
                this.earth_svg.projection.rotate(new_earth_rotaing);
                let forMap_rotation = this.earth_svg.projection.rotate().map(x => to_radians(x));
                map.selectAll("path").attr("d", this.earth_svg.path);
                // console.log(new_earth_rotaing);
                drawScene(gl, programInfo, [forMap_rotation[0], forMap_rotation[1]]);
                if(!this.isRotate){
                    earth_rotation.stop();
                }
            });
        }
// let earth_rotation = d3.timer((elasped) => {
            //     let new_earth_rotaing = [this.earth_rotating[0] + elasped * this.earth_speed / 1000, this.earth_rotating[1], this.earth_rotating[2]];
            //     this.svg_element.projection.rotate(new_earth_rotaing);
            //     this.svg_element.svg.selectAll("path").attr("d", this.svg_element.path);
            //     if (!this.isRotate) {
            //         this.earth_rotating = new_earth_rotaing;
            //         earth_rotation.stop();
            //     }
            // });

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
        let map_svg = await this.createEarthSvg();
        this.earth_svg.svg_element.node().append(map_svg);
    }
});

app.mount("#app");