$(document).ready(function () {
    setTimeout(function () {
        $('.sk-circle').hide();
        $('iframe').show();
    }, 1000);
    window.addEventListener('message', function (event) {
        if (event.data.height) {
            let newHeigth = parseInt(event.data['height']);
            if(newHeigth > 600) {
                newHeigth = 600;
            }
            if (newHeigth !== $('#iframe').css('heigth')) {
                $("html,body").scrollTop(0);
                $('#iframe').css({'height': newHeigth +'px'});
            }
        }
    })
});
