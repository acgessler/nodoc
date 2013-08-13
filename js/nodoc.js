
var DocumentationViewer = (function(undefined) { 
	
return function(settings) {
	settings = settings || {};

	var base_folder = settings.base_folder || '';
	if (base_folder && base_folder[base_folder.length-1] !== '/') {
		base_folder = base_folder + '/';
	}

	var fetch_infoset = (function() {

		var infoset_cache_waiters = {};
		var infoset_cache = {};

		// mini ajax fetcher for infosets with caching
		return function(what, callback) {
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
				if (ajax.readyState === 4) {
					var infoset = null;
					if(ajax.status === 200) {
						infoset = JSON.parse(ajax.responseText);
					}
					var waiters = infoset_cache_waiters[what];
					for (var i = 0; i < waiters.length; ++i) {
						waiters[i](infoset);
					}
				}
			}

			ajax.open("GET", base_folder + what + "?nocache=" + new Date().getTime(),true);
			ajax.send(null);
		};
	}) ();


	var method_full_template = _.template(
		'<div class="method"> ' +
			'<div class="method_info <%= access_spec %>"> </div> ' +
			'<div class="method_info <%= extra_spec %>"> </div> ' +
			'<h3> '+
				'<font size="-1"> ' +
					'<%= access_spec %> ' +
					'<%= extra_spec %>  ' +
					'<%= return_type %> ' +
				'</font> ' +
				'<%= name %>  ' +
				'(<%= parameters %>) '+
			'</h3>  ' +
			'<%= comment %> <hr> '+
		'</div>');

	var class_template = _.template(
		'<h1> ' +
			'<font size="-1">' + 
				'<%= access_prefix %> <%= extra_prefix %> <%= type %> '+
			'</font> '+
			'<%= name %> '+
		'</h1> '+
		'<%= long_desc %>');

	var method_index_entry_template = _.template(
		'<li> '+
			'<a href="#"> '+
				'<%= name %> (<%= parameters %>) '+
			'</a>'+
		'</li>');

	var ctor_index_entry_template = _.template(
		'<li>'+
			'<a href="#">'+
				'&diam; <%= name %> (<%= parameters %>) '+
			'</a>'+
		'</li>');

	var method_index_template = _.template('<hr>'+
		'<div class="index">'+
			'<ul>'+
				'<%= index %>'+
			'</ul>'+
		'</div>');

	// generate search box
	var index = fetch_infoset('output/index.json', function(index) {
		elems = [];
		for (var k in index) {
			elems.push('<li>'+k+'</li>');
		}

		var e = $('#live_search');
		e.html(elems.join(''));
		e.children('li').hover(function(e) {
			open_class('output/class_' + $(this).text() + '.json');
		});
		$('input[name="search"]').liveUpdate( e );

		$(e).mCustomScrollbar({
			theme: "dark-thick" 
		});
	});


	this.open_class = function(file, completion) {
		fetch_infoset(file, function(infoset) {
			if (!infoset) {
				if (completion) {
					completion(false);
				}	
				return;
			}
			var text = class_template(infoset);

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

			if(completion) {
				completion(true);
			}
		});
	}
}; 
})();


function run() {
	var doc = new DocumentationViewer();
	doc.open_class('output/class_Object.json');
}
