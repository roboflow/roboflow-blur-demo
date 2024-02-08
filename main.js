/*jshint esversion:6*/

$(function () {
  document.documentElement.requestFullscreen();
  const video = $("video")[0];

  var model;
  var cameraMode = "environment"; // or "user"

  const startVideoStreamPromise = navigator.mediaDevices
    .getUserMedia({
      audio: false,
      video: {
        facingMode: cameraMode,
      },
    })
    .then(function (stream) {
      return new Promise(function (resolve) {
        video.srcObject = stream;
        video.onloadeddata = function () {
          video.play();
          resolve();
        };
      });
    });

  var publishable_key = "rf_EsVTlbAbaZPLmAFuQwWoJgFpMU82";
  var toLoad = {
    model: "coco",
    version: 3,
  };

  const loadModelPromise = new Promise(function (resolve, reject) {
    roboflow
      .auth({
        publishable_key: publishable_key,
      })
      .load(toLoad)
      .then(function (m) {
        model = m;
        model.configure({ threshold: 0.1 });
        resolve();
      });
  });

  Promise.all([startVideoStreamPromise, loadModelPromise]).then(function () {
    $("body").removeClass("loading");
    resizeCanvas();
    detectFrame();
  });

  var canvas, ctx;
  var canvas2, ctx2;
  const font = "16px sans-serif";

  function videoDimensions(video) {
    // Ratio of the video's intrisic dimensions
    var videoRatio = video.videoWidth / video.videoHeight;

    // The width and height of the video element
    var width = video.offsetWidth,
      height = video.offsetHeight;

    // The ratio of the element's width to its height
    var elementRatio = width / height;

    // If the video element is short and wide
    if (elementRatio > videoRatio) {
      width = height * videoRatio;
    } else {
      // It must be tall and thin, or exactly equal to the original ratio
      height = width / videoRatio;
    }

    return {
      width: width,
      height: height,
    };
  }

  $(window).resize(function () {
    resizeCanvas();
  });

  const resizeCanvas = function () {
    $("canvas").remove();

    canvas = $("<canvas/>");
    canvas2 = $("<canvas/>");

    ctx = canvas[0].getContext("2d");
    ctx2 = canvas2[0].getContext("2d");

    var dimensions = videoDimensions(video);

    console.log(
      video.videoWidth,
      video.videoHeight,
      video.offsetWidth,
      video.offsetHeight,
      dimensions
    );

    canvas[0].width = video.videoWidth;
    canvas[0].height = video.videoHeight;
    canvas2[0].width = video.videoWidth;
    canvas2[0].height = video.videoHeight;
    let yOffset =
      (screen.width / video.videoWidth) * video.videoHeight - screen.height;

    canvas.css({
      width: "100vw",
      height: (screen.width / video.videoWidth) * video.videoHeight + "px",
      left: 0,
      top: -yOffset / 2 + "px",
    });
    canvas2.css({
      width: "100vw",
      height: (screen.width / video.videoWidth) * video.videoHeight + "px",
      left: 0,
      top: -yOffset / 2 + "px",
      zIndex: -10,
    });

    $("body").append(canvas);
    $("body").append(canvas2);
  };

  const renderPredictions = function (predictions) {
    var dimensions = videoDimensions(video);

    var scale = 1;

    ctx2.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    let imgDrow = [];

    ctx2.filter = "blur(10px)";
    ctx2.drawImage(video, 0, 0, ctx2.canvas.width, ctx2.canvas.height);
    predictions = predictions.filter((p) => p.class === "donut");

    predictions.forEach(function (prediction) {
      const x = prediction.bbox.x;
      const y = prediction.bbox.y;

      const width = prediction.bbox.width;
      const height = prediction.bbox.height;

      imgDrow.push(
        ctx2.getImageData(
          (x - width / 2) / scale,
          (y - height / 2) / scale,
          width / scale,
          height / scale
        )
      );
    });

    console.log(imgDrow.length);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = "none";
    ctx.drawImage(video, 0, 0);

    imgDrow.forEach((img, i) => {
      const x = predictions[i].bbox.x;
      const y = predictions[i].bbox.y;

      const width = predictions[i].bbox.width;
      const height = predictions[i].bbox.height;
      ctx.putImageData(img, (x - width / 2) / scale, (y - height / 2) / scale);
    });

    // predictions.forEach(function (prediction) {
    //   const x = prediction.bbox.x;
    //   const y = prediction.bbox.y;

    //   const width = prediction.bbox.width;
    //   const height = prediction.bbox.height;

    //   // Draw the text last to ensure it's on top.
    //   //   ctx.font = font;
    //   //   ctx.textBaseline = "top";
    //   //   ctx.fillStyle = "#000000";
    //   //   ctx.fillText(
    //   //     prediction.class,
    //   //     (x - width / 2) / scale + 4,
    //   //     (y - height / 2) / scale + 1
    //   //   );
    // });
  };

  var prevTime;
  var pastFrameTimes = [];
  const detectFrame = function () {
    if (!model) return requestAnimationFrame(detectFrame);

    model
      .detect(video)
      .then(function (predictions) {
        requestAnimationFrame(detectFrame);
        renderPredictions(predictions);

        if (prevTime) {
          pastFrameTimes.push(Date.now() - prevTime);
          if (pastFrameTimes.length > 30) pastFrameTimes.shift();

          var total = 0;
          _.each(pastFrameTimes, function (t) {
            total += t / 1000;
          });

          var fps = pastFrameTimes.length / total;
          $("#fps").text(Math.round(fps));
        }
        prevTime = Date.now();
      })
      .catch(function (e) {
        console.log("CAUGHT", e);
        requestAnimationFrame(detectFrame);
      });
  };
});
