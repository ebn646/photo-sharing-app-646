import io from 'socket.io-client';
import { ajax, showStatus, gethost } from './utils.js';
import { init } from './comments.js';
import '../scss/main.scss';

var host = gethost();
var socket = io(host);
var patharray = window.location.pathname.split('/');
 

if(patharray[1] == 'comments'){
    init(host, socket)
}
socket.on('status', function (data) {
    showStatus(data.msg, data.delay);
})

socket.on('doUpdate', function () {
    renderList();
})

function getImageSize(img, callback) {
    var $img = $(img);

    var wait = setInterval(function() {
        var w = $img[0].naturalWidth,
            h = $img[0].naturalHeight;
        if (w && h) {
            clearInterval(wait);
            callback.apply(this, [w, h]);
        }
    }, 30);
}
// initailize comments module

// render list of images on page load

const renderList = () => {
    $('.gallery .row').html('');
    ajax({
        url: host + '/getimages/',
        success: function (data) {
            var imageList = JSON.parse(data.response);
            for (let i = 0; i < imageList.length; i++) {
                var img = $('<img />').attr({
                    'src': 'https://s3.amazonaws.com/photobucket-646/' + imageList[i].filename
                });     
                
                var comments;
                    if(imageList[i].comments == undefined){
                        comments = 0;
                    }else{
                        comments = imageList[i].comments;
                    }

                var str = `<div class="col-md-4 photocard">
                    <div class="photocard__imageHolder">
                    </div>
                    <div class="overlay">
                        <div class="photocard__voteCtrl">
                            <button type="button" class="btn btn-light button__flex">
                                <a href="javascript:void(0)" data-photoid="` + imageList[i]._id + `" class="voteUp">
                                    <img src="../images/voteup.png" alt="Click Here to Vote Up !">
                                    <h6>` + imageList[i].votes + `</h6>
                                </a>
                            </button>
                        </div>
                        <div class="photocard__commentCtrl">
                        <button type="button" class="btn btn-light button__flex">
                            <a href="/comments/`+ imageList[i]._id + `" data-photoid="` + imageList[i]._id + `">
                                <i class="fas fa-comments"></i>
                                <h6>` + comments + `</h6>
                            </a>
                        </button>
                        </div>
                    </div>
                </div>`
                $('.gallery .row').append(str);

                $('.col-md-4').find('.photocard__imageHolder').eq(i).append(img)

                getImageSize(img, function(width, height) {
                    if(width/height > 1){
                        $('.gallery .row .col-md-4').eq(i).find('img').addClass('wide')
                    }else{
                        $('.gallery .row .col-md-4').eq(i).find('img').addClass('tall')
                    }
                });
            }
        }
    });
}

renderList();

$(document).on('click', '#doUpload', function () {
    uploadNow();
})

function uploadNow() {
    $('.progress').fadeIn(100);
    var uploadURL = host + '/upload';
    var uploadFile = $('.uploadPic');
    if (uploadFile.val() != '') {
        var form = new FormData();
        form.append("upload", uploadFile[0].files[0]);
        // Perform the AJAX POST request and send the file
        ajax({
            method: 'post',
            url: uploadURL,
            success: function () {
                $('.progress').fadeOut(200);
                uploadFile.val('');
            },
            progress: function (e) {
                if (e.lengthComputable) {
                    var perc = Math.round((e.loaded * 100) / e.total);
                    $('.progress').css('width', (perc + '%'));
                }
            },
            payload: form
        })
    }
}


//============== ADD COMMENT TO IMAGE =================

$(document).on('click', '.voteUp', function (e) {
    var that = $(this);
    ajax({
        url: host + '/voteup/' + that.data('photoid'),
        success: function (data) {
            var parseData = JSON.parse(data.response);
            that.find('h6').html(parseData.votes + 1);
        }
    });
});

$(function(){
    $(document).on('change', '.uploadPic', function(e){
        var ext = this.value.match(/\.([^\.]+)$/)[1].toLowerCase();
        var permit = ['jpg','gif','png'];
        if(permit.indexOf(ext)>-1){
            showStatus('Ready to Upload !', 600);
        } else {
            showStatus('Your Chosen File Is Not Permitted !! Please pick JPG, GIF or PNG files only !', 4000);
            $(this).val('');
        }
    })
})


