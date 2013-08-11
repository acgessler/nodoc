var infoset_cache_waiters = {};
var infoset_cache = {};

// mini ajax fetcher for infosets with caching
function fetch_infoset(what, callback) {
	if(infoset_cache[what]) {
		callback(infoset_cache[what]);
	}

	if(infoset_cache_waiters[what]) {
		infoset_cache_waiters[what].push(callback);
		return;
	}

	infoset_cache_waiters[what] = [callback];

	var ajax;
		if (window.XMLHttpRequest) {
  		ajax = new XMLHttpRequest();
	}
	else {
  		ajax = new ActiveXObject("Microsoft.XMLHTTP");
	}

	ajax.onreadystatechange = function() {
		if (ajax.readyState==4) {
			var infoset = JSON.parse(ajax.responseText);

			var waiters = infoset_cache_waiters[what];
			for (var i = 0; i < waiters.length; ++i) {
				waiters[i](infoset);
			}
		}
	}

	ajax.open("GET",what + "?nocache=" + new Date().toString(),true);
	ajax.send(null);
}

method_full_template = _.template('<div class="method"> \
	<div class="method_info <%= access_spec %>"> </div> \
	<div class="method_info <%= extra_spec %>"> </div> \
	 <h3> <font size="-1"> \
	<%= access_spec %> \
	<%= extra_spec %>  \
	<%= return_type %> </font> \
	<%= name %>  \
	(<%= parameters %>) </h3>  \
	<%= comment %> <hr> </div>');

method_index_entry_template = _.template('<li> <a href="#"> <%= name %> (<%= parameters %>) </a> </li>');
ctor_index_entry_template = _.template('<li> <a href="#"> &diam; <%= name %> (<%= parameters %>) </a> </li>');

method_index_template = _.template('<hr> <div class="index"><ul> <%= index %> </ul></div>');


function run() {
	fetch_infoset('output/class_Object.json', function(infoset) {
		var text = '<h1> <font size="-1">' + infoset.access_prefix + ' ' + 
			infoset.extra_prefix + ' ' +
			 infoset.type + ' </font>' + 
			 infoset.name + '</h1>' + 
			 infoset.long_desc;
		

		var method_index = "";
		var methods = "";
		for (var name in infoset.members) {
			var overloads = infoset.members[name];

			for(var i = 0; i < overloads.length; ++i) {
				var m = overloads[i];
				
				method_index += (name === infoset.name 
					? ctor_index_entry_template 
					: method_index_entry_template )(m);

				methods += method_full_template(m);
			}
		}

		$(".left").html(text + method_index_template({ index : method_index}) );
		$(".right").html(methods);

		$(".left, .right").mCustomScrollbar({
			theme: "dark-thick" 
		});
		$('.index li').addClass("dontsplit"); 
		$('.index').columnize({
			columns: 2
		});

		$('pre').addClass("prettyprint lang-java");
		prettyPrint();
	});
}