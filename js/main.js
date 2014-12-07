// icon http://www.flaticon.com/free-icon/japan-food_13200

if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function (str){
    return this.indexOf(str) == 0;
  };
}

(function(global, $, undefined) {
  var console = global.console;
  var localStorage = global.localStorage;
  var JSON = global.JSON;
  var parseInt = global.parseInt;

  var CACHE_MAX_AGE = 300; // 300 seconds == 5 minutes
  var API = 'http://api.b.st-hatena.com/entry.count?url=';
  var IMAGE_API = 'http://b.hatena.ne.jp/entry/image/';

  // 現在の秒数
  function now_seconds(){
    return new Date().getTime() / 1000
  }

  // localStorageからの取得とJSON.parse
  function fetch_cache(key){
    var json_str = localStorage.getItem(key);
    return JSON.parse(json_str ? json_str : '{}');
  }

  // 期限切れキャッシュの削除
  function clear_cache_if_expired(){
    Object.keys(localStorage).forEach(function(key){
      if(!key.startsWith('http')) return;
      var cache = fetch_cache(key);
      if(!cache || !cache['created_at'] || cache['created_at'] < now_seconds() - CACHE_MAX_AGE){
        localStorage.removeItem(key);
      }
    });
  }

  // はてぶ画像っぽいspanを作る
  function hatebu_dummy_image(num, font_size){
    var font_size = font_size ? font_size : 11;
    return $('<span style="color: #FF6664; background-color: #FFEFEF;" />').text(num + ' users').css('font-size', font_size + 'px')
  }

  // DOMにはてぶ数を追加
  function append_count(context, cache){
    context
      .attr('title', 'hateb: ' + cache['count'])
      .append('&nbsp;');

    if(cache['count'] == 0){
      context.append(hatebu_dummy_image(0));
    }else{
      context.append($('<img />').attr('src', cache['image']));
    }
  }

  // 現在のカレンダーのはてぶ数合計をtableタグのcaptionに追加
  function hatebu_sum(){
    var sum = 0;
    Object.keys(localStorage).forEach(function(key){
      if(!key.startsWith('http')) return;
      var cache = fetch_cache(key);
      sum += cache['count'] ? parseInt(cache['count']) : 0;
    });
    $('table.adventCalendar_calendar_table.table')
        .find('caption')
        .remove()
        .end()
        .prepend($('<caption style="text-align: left;" />').html(hatebu_dummy_image(sum, 28)));
  }

  // DOMを更新
  function update(context, cache){
    append_count(context, cache);
    hatebu_sum();
  }

  function hatebu_count(blog, context){
    var cache = fetch_cache(blog);
    if(cache && cache['created_at'] > now_seconds() - CACHE_MAX_AGE){
      update(context, cache);
    }else{
      $.get(API + encodeURIComponent(blog), function(res){
        var count = res == '' ? 0 : parseInt(res);
        var image = IMAGE_API + blog;
        var cache = {
          count: count,
          image: image,
          blog: blog,
          calendar: global.location.href,
          created_at: now_seconds()
        };
        localStorage.setItem(blog, JSON.stringify(cache));
        update(context, cache);
      });
    }
  }

  clear_cache_if_expired();

  $('table.adventCalendar_calendar_table.table td.adventCalendar_calendar_day').each(function(){
    var td = $(this);
    var author = td.find('p.adventCalendar_calendar_author a');
    var blog = td.find('p.adventCalendar_calendar_entry a').attr('href');
    if(blog === undefined || blog == ''){
      return true
    }

    hatebu_count(blog, author);
  });
})(window, jQuery);