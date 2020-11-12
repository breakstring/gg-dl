const mergeImg = require("merge-img");
const axios = require("axios");
const xml2js = require("xml2js");
const dl = require('retriable-download');
const fs = require('fs');
const path = require('path');
const del = require("del");
const cli = require("cli");
const moveFile = require('move-file');


async function CheckLevel(ext){
    var i = 0;
    var stopFlag = true;
    while(stopFlag){
        try {
            const check = await new dl(imgPath + i + '/0_0' + ext,1);
            i++;
        } catch (error) {
            stopFlag = false;
        }
    }
    return (i-1);
}

async function GetPictures(){
    const xmlResponse = await axios.get(xmlPath);
    const xmlData = xmlResponse.data;
    
    var xmlParser = new xml2js.Parser({attrkey:"xmlAttribute"});
    var xmlResult = await xmlParser.parseStringPromise(xmlData);
    var fileFormat = xmlResult.Image.xmlAttribute.Format;
    var fileExt = '.' + fileFormat;
    var tileOverlap = Number.parseInt(xmlResult.Image.xmlAttribute.Overlap);
    var tileSize = Number.parseInt(xmlResult.Image.xmlAttribute.TileSize);
    var picWidth = Number.parseInt(xmlResult.Image.Size[0].xmlAttribute.Width);
    var picHeight = Number.parseInt(xmlResult.Image.Size[0].xmlAttribute.Height);

    cli.spinner("检查图片清晰度层级。。。");
    var tileLevel = await CheckLevel(fileExt);
    cli.spinner("检查图片清晰度完毕。",true);

    imgPath = imgPath + tileLevel + "/";

    var wLevel = Math.floor(picWidth / (tileSize + tileOverlap));
    var hLevel = Math.floor(picHeight / (tileSize + tileOverlap));



    var fileCount = (wLevel + 1) * (hLevel + 1);

    cli.info("删除掉临时文件夹中的图片");
    await del("./image/source/*.*");
    await del("./image/temp/*.*");
    cli.info("开始下载文件。。。。。。");
    var counter=0;
    for (var i = 0; i <= wLevel;i++){
        for(var j = 0; j<=hLevel;j++){
            cli.progress(counter/fileCount);
            const imageFileName = i + '_' + j + fileExt;
            const imageURL = imgPath + imageFileName;
            const downloader = await new dl(imageURL,3);
            const targetFile = path.resolve(process.cwd(),"image","source",imageFileName);
            await moveFile(downloader,targetFile);
            counter++;
        }
    }
    cli.progress(1);
    cli.spinner("下载完毕！开始合并。。。。。。。。");
    var ol = tileOverlap * 2 * -1;
    var resultName = await Go(wLevel,hLevel,fileExt,ol);
    cli.spinner("下载完毕！合并为：" + resultName,true);
}

async function Go(w,h,ext,ol){
    for (var i = 0; i <= w;i++){
        for(var j = 0; j<=h;j++){
            imageArr.push('./image/source/' + i +'_' + j + ext);
        }
        var img = await mergeImg(imageArr,{direction:true, offset:ol});
        await img.write("./image/temp/" + i + ext);
        imageArr = [];
    }

    
    for (var i = 0; i <= w;i++){
        imageArr.push('./image/temp/' + i + ext);
    }

    var img = await mergeImg(imageArr,{direction:false, offset:ol});
    
    var resultFileName = process.argv[3] + ext;

    await img.write("./image/result/" + resultFileName);
    return resultFileName;

}

if(process.argv.length <= 3) {
    cli.error("请加上参数: \n参数1：图片的地址，形如 https://en.dpm.org.cn/dyx.html?path=/tilegenerator/dest/files/image/8831/2009/0705/img0003.xml \n参数2：要存成的图片名，不要后缀名，形如 某某某");
    process.exit(1);
  
}

var fullURL = new URL(process.argv[2]);
var tilePath = fullURL.searchParams.get('path');
var xmlPath = fullURL.origin + tilePath;
var imgPath = xmlPath.replace('.xml','_files/');
var imageArr=[];

GetPictures();

