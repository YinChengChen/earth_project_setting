import "./scss/all.scss";
import { createApp } from "vue";
import axios from "axios";
import { feature } from "topojson";
import * as d3 from "d3";
import { Legend } from "./js/legend.js";
import { bilinear_interpolation, wind_color_scale_accurate } from "./js/wind";
import { dragstarted, dragged, dragend } from "./js/d3drag";
import { zoomstarted, zoomed, zoomend, resizestarted, resizeend } from "./js/d3zoom";
import { createVertexShader, createFragmentShader, createVertexBuffer, createProgram, createTexture } from "./js/webglFunction";
import { overlayData } from "./js/dataObject";
import { api } from "./js/getApi";
// import { overlayData } from "./js/dataObject";


const app = createApp({
    data() {
        return {
            text: "測試vue",
            mapData: [],
            vectorData: [],
            earth_id: "#earth",
            earth_svg: [],
            earth_width: null,
            earth_height: null,
            initial_longitude: 0,
            earth_projection: [],
            earth_sphere: {
                type: "Sphere"
            },
            number_of_prarticles: 3500,
            wind_scale: []
        }
    },
    methods: {
        getMapData(url){
            return axios.get(url);
        },
        getVectorData(url){
            return axios.get(url);
        },
        // async getMapData(url) {
        //     let selfs = this;
        //     // let url = "https://unpkg.com/world-atlas@1/world/110m.json";
        //     // let res = await api.get(url);
        //     // this.mapData = res;
        //     // console.log(res);
        //     await axios.get(url).then((response) => {
        //         selfs.mapData = response.data;
        //         // this.createSvg();
        //     });
        // },
        // getVectorData(url) {
        //     let self = this;

        //     axios.get(url).then((response) => {
        //         self.vectorData = overlayData(response.data);
        //     });
        //     console.log(self.vectorData);
        // },
        setLegend() {
            let legend = Legend(d3.scaleSequential([0, 100], d3.interpolateTurbo), {
                title: "Temperature (°F)"
            });
            let legend_svg = d3.select("#legend");
            legend_svg.node().appendChild(legend);
            // // 設置 colorbar 風場的
            // const scale = d3.scaleSequential().domain([0, 200]).interpolator(interpolate_wind_sinebow);
            // // console.log(scale);
            // const wind_legend = Legend(scale, {
            //     title: "Wind Speed (m/s)"
            // });
            // // console.log(wind_legend);
            // // svg.node().appendChild(wind_legend);
        },
        getEarthSvg() {
            this.earth_svg = d3.select(this.earth_id);
            this.earth_projection = d3.geoOrthographic().precision(0.1).rotate([-this.initial_longitude, 0]);
        },
        setEarthWidth() {
            this.earth_width = this.earth_svg.node().getBoundingClientRect().width;
        },
        setEarthHeight() {
            this.earth_height = this.setHeight();
        },
        setHeight() {
            let [[x0, y0], [x1, y1]] = d3.geoPath(this.earth_projection.fitWidth(this.earth_width, this.earth_sphere)).bounds(this.earth_sphere);
            const dy = Math.ceil(y1 - y0), l = Math.min(Math.ceil(x1 - x0), dy);
            this.earth_projection.scale(this.earth_projection.scale() * (l - 1) / l).precision(0.2);
            return dy;
        },
        setEarthMap(mapData) {
            let v0, q0, r0, frame, resize_flag, animation_flag;
            let animation_play = false;
            let particles = [];
            let N = this.number_of_prarticles;
            // 建立新的 svg
            let svg = d3.create("svg").attr('viewBox', [0, 0, this.earth_width, this.earth_height]).attr('fill', 'black').attr('preserveAspectRatio', 'xMinYMid');

            this.earth_projection.fitSize([this.earth_width, this.earth_height], d3.geoGraticule10());
            const path = d3.geoPath(this.earth_projection);
            const graticule = d3.geoGraticule10();
            // contains all elements that are draggable
            // 這邊先把 drag 寫上並包含開始結束動作，但是尚未撰寫動畫 function
            const map = svg.append("g").attr("id", "map").attr("width", this.earth_width).attr("height", this.earth_height)
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
            // 長方形黑色畫布 如果背景是黑的應該就不用 ?
            map.append("rect").attr("x", 0).attr("y", 0).attr("width", this.earth_width).attr("height", this.earth_height).attr("fill", "#000005");
            // 地球投影: 一顆黑色圓形線，fill 要用 none 清除填滿
            map.append("path").attr("class", "outline").attr("stroke", "#000").attr("fill", "none").attr("stroke-width", 1).attr("d", path(this.earth_sphere));
            // 地球格線
            map.append("path").attr("class", "graticule").attr("stroke", "#ffffff").attr("stroke-width", 0.4).attr("d", path(graticule));
            // 世界地圖
            map.append("path").attr("class", "coastline").attr("stroke", "#ffffff").attr("stroke-width", 0.8).attr("fill", "none").attr("d", path(mapData));
            // Wind Overlay 困難的部分
            // 建立 foreignObject，因為 canvas 屬於 xmls 系統，一般 html 不會識別
            const foreignObject = map.append("foreignObject").attr("x", 0).attr("y", 0).attr("width", this.earth_width).attr("height", this.earth_height);
            // 建立 foreignObject 的身體(應該就是畫布的概念) 不要用 style 藥用 attr 設定 css 屬性
            const foreignBody = foreignObject.append("xhtml:body").attr("margin", "0px").attr("padding", "0px").attr("background-color", "none").attr("width", this.earth_width + "px").attr("height", this.earth_height + "px");
            // 添加 canvas 給動畫用 這邊尚未有透明背景，會遮住 map
            const canvas_wind_overlay = foreignBody.append("canvas").attr("id", "canvas-wind-overlay").attr("x", 0).attr("y", 0).attr("width", this.earth_width).attr("height", this.earth_height).attr("position", "absolute");
            // 使用 WebGl 重新用柵格投影
            const gl = canvas_wind_overlay.node().getContext('webgl', { alpha: true });
            // console.log(gl);
            const vertexShader = createVertexShader(gl);
            // console.log(vertexShader);
            const fragmentShader = createFragmentShader(gl);
            // console.log(fragmentShader);
            const vertexBuffer = createVertexBuffer(gl);
            // console.log(vertexBuffer);
            const wind_overlay = this.setWindOverlay();
            console.log(wind_overlay);
            // const texture = createTexture(gl, canvas_wind_overlay);
            // console.log(texture);
            const program = createProgram(gl, vertexShader, fragmentShader);
            // console.log(program);
            return svg.node();
        },
        createSvg() {
            let mapdata = feature(this.mapData, this.mapData.objects.countries);
            let svg_earth = this.setEarthMap(mapdata);
            this.earth_svg.node().append(svg_earth);
        },
        get_color(long, lat) {
            let wind_strength;
            if ((long in this.vectorData) && (lat in this.vectorData[long])) {
                wind_strength = this.vectorData[Math.floor(long)][Math.floor(lat)]["wind_strength"];
            } else {
                wind_strength = bilinear_interpolation(long, lat, "wind_strength", this.vectorData);
            }
            let color = this.wind_scale(wind_strength);
            let matchColor = /rgb\((\d{1,3}), (\d{1,3}), (\d{1,3})\)/;
            let match = matchColor.exec(color);
            // console.log("match:", match);
            return {
                "red": parseInt(match[1]),
                "green": parseInt(match[2]),
                "blue": parseInt(match[3]),
            };
        },
        setWindScale(){
            this.wind_scale = wind_color_scale_accurate();
        },
        setWindOverlay(){
            const lightness = 0.75;
            const image_width = 4096 / 4;
            const image_height = 2048 / 4;
            const array_size = 4 * image_width * image_height;
            const projection_overlay = d3.geoEquirectangular().precision(0.1).fitSize([image_width, image_height], d3.geoGraticule10());

            let overlay_array = new Uint8ClampedArray(array_size);

            let x = 0;
            let y = 0;

            for (let i = 0; i < array_size; i=i+4){
                let coords = projection_overlay.invert([x, y]);
                if (Math.abs(coords[1]) > 90){
                    console.log(x, y, coords, i, array_size);
                }
                // console.log("coord:", coords);
                let color = this.get_color(coords[0], coords[1]);
                overlay_array[i] = color['red'] * lightness;
                overlay_array[i+1] = color['green'] * lightness;
                overlay_array[i+2] = color['blue'] * lightness;
                overlay_array[i+3] = 200;
                // move to the next pixel
                if (x < image_width - 1){
                    x = x + 1;
                }else{
                    x = 0;
                    y = y + 1;
                }
            }
            // let overlay_graphics = new ImageData(overlay_array, image_width);
            let context = DOM.context2d(image_width, image_height, 1);
            let imageData = new ImageData(overlay_array, image_width, image_height);
            createImageBitmap(imageData).then(result => context.drawImage(result, 0, 0, image_width, image_height));
            return context.canvas;
        }


    },
    created(){
        // this.getMapData("https://unpkg.com/world-atlas@1/world/110m.json");
        // this.getVectorData("current-wind-surface-level-gfs-1.0.json");
    },
    mounted() {
        // this.getMapData("https://unpkg.com/world-atlas@1/world/110m.json");
        // this.getVectorData("current-wind-surface-level-gfs-1.0.json");
        // this.setLegend();
        axios.all([this.getMapData("https://unpkg.com/world-atlas@1/world/110m.json"), this.getVectorData("current-wind-surface-level-gfs-1.0.json")])
            .then(axios.spread((acct, perms) => {
                // console.log(acct); // 第一個回傳的 proxy
                // console.log(perms); // 第二個回傳的 proxy
                this.mapData = acct.data;
                this.vectorData = overlayData(perms.data);
                this.getEarthSvg();
                this.setEarthWidth();
                this.setEarthHeight();
                this.setWindScale();
                this.createSvg();

            }));

        // 取得 svg 的寬度

    }
});
app.mount("#app");


// // console.log(legend);


// const svg = d3.select("#earth");
// // 初始經度範圍 -180 ~ 180，在前面加上 "-"
// const initial_longitude = 0;
// const projection = d3.geoOrthographic().precision(0.1).rotate([-initial_longitude, 0]);
// const sphere = {
//     type: "Sphere"
// };
// const width = svg.node().getBoundingClientRect().width;

// const height = setHeight();


// console.log(width, height);
// // svg.node().appendChild(legend); // legend 回傳 node 必須用 node appendChild 加入 svg 裡



// // 線段點數量
// const number_of_prarticles = 3500;

// // overlay 資料取得測試
// // const wind_overlay = getOverlayData();
// // console.log(wind_overlay);
// // 地圖資料取得
// async function getData(data_url) {
//     try {
//         let response = await axios({
//             url: data_url,
//             method: "get",
//             timeout: 8000,
//             headers: {
//                 'Content-Type': 'application/json',
//             }
//         });
//         if (response.status === 200) {
//             console.log(response.status);
//         }
//         return response.data;
//     } catch (err) {
//         console.error(err);
//     }
// }

// getData("https://unpkg.com/world-atlas@1/world/110m.json").then((earth_topography_110) => {
//     // console.log(earth_topography_110);
//     let mapdata = feature(earth_topography_110, earth_topography_110.objects.countries);
//     const svg_earth = chart_svg_d3(mapdata);
//     // console.log(svg.node());
//     svg.node().append(svg_earth);
// });
// // const earth_topography_110 = await (axios.get("https://unpkg.com/world-atlas@1/world/110m.json").then((response) => {
// //     return response.data;
// // }););
// // console.log(earth_topography_110);



// function chart_svg_d3(mapdata) {
//     let v0, q0, r0, frame, resize_flag, animation_flag;
//     let animation_play = false;
//     let particles = [];
//     let N = number_of_prarticles;
//     // 建立新的 svg
//     let svg = d3.create("svg").attr('viewBox', [0, 0, width, height]).attr('fill', 'black').attr('preserveAspectRatio', 'xMinYMid');

//     projection.fitSize([width, height], d3.geoGraticule10());
//     const path = d3.geoPath(projection);
//     const graticule = d3.geoGraticule10();
//     // contains all elements that are draggable
//     // 這邊先把 drag 寫上並包含開始結束動作，但是尚未撰寫動畫 function
//     const map = svg.append("g").attr("id", "map").attr("width", width).attr("height", height)
//         .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragend))
//         .call(d3.zoom().scaleExtent([200, 1440]).on("start", zoomstarted).on("zoom", zoomed).on("end", zoomend));

//     // 有一個 addEventListener 不確定監聽哪個元素
//     // 應該是偵測 zoom 行為作出地球大小改變
//     addEventListener('resize', function () {
//         if (resize_flag) {
//             // 需要 this 麻?
//             clearTimeout(resize_flag);
//         }
//         resizestarted();
//         resize_flag = setTimeout(() => resizeend(), 100);
//     });
//     // 長方形黑色畫布 如果背景是黑的應該就不用 ?
//     map.append("rect").attr("x", 0).attr("y", 0).attr("width", width).attr("height", height).attr("fill", "#000005");
//     // 地球投影: 一顆黑色圓形線，fill 要用 none 清除填滿
//     map.append("path").attr("class", "outline").attr("stroke", "#000").attr("fill", "none").attr("stroke-width", 1).attr("d", path(sphere));
//     // 地球格線
//     map.append("path").attr("class", "graticule").attr("stroke", "#ffffff").attr("stroke-width", 0.4).attr("d", path(graticule));
//     // 世界地圖
//     map.append("path").attr("class", "coastline").attr("stroke", "#ffffff").attr("stroke-width", 0.8).attr("fill", "none").attr("d", path(mapdata));
//     // Wind Overlay 困難的部分
//     // 建立 foreignObject，因為 canvas 屬於 xmls 系統，一般 html 不會識別
//     const foreignObject = map.append("foreignObject").attr("x", 0).attr("y", 0).attr("width", width).attr("height", height);
//     // 建立 foreignObject 的身體(應該就是畫布的概念) 不要用 style 藥用 attr 設定 css 屬性
//     const foreignBody = foreignObject.append("xhtml:body").attr("margin", "0px").attr("padding", "0px").attr("background-color", "none").attr("width", width + "px").attr("height", height + "px");
//     // 添加 canvas 給動畫用 這邊尚未有透明背景，會遮住 map
//     const canvas_wind_overlay = foreignBody.append("canvas").attr("id", "canvas-wind-overlay").attr("x", 0).attr("y", 0).attr("width", width).attr("height", height).attr("position", "absolute");
//     // 使用 WebGl 重新用柵格投影
//     const gl = canvas_wind_overlay.node().getContext('webgl', { alpha: true });
//     // console.log(gl);
//     const vertexShader = createVertexShader(gl);
//     // console.log(vertexShader);
//     const fragmentShader = createFragmentShader(gl);
//     // console.log(fragmentShader);
//     const vertexBuffer = createVertexBuffer(gl);
//     // console.log(vertexBuffer);
//     // const texture = createTexture(gl, canvas_wind_overlay);
//     // console.log(texture);
//     const program = createProgram(gl, vertexShader, fragmentShader);
//     // console.log(program);

//     return svg.node();

// }


// // svg.a.append(svg_earth);

// // wind_color_scale_accurate = {
// //
// //     return scale;
// // };
// // const wind_legend = Legend({
// //     color: wind_c
// // })






