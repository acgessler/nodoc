

describe("view.ClassRenderer", function() {

  var doc;
  var view_planes;
  beforeEach(function() {
    doc = new DocumentationViewer({
        base_folder : ".."
        });

    view_planes = {
      push : function() {
      },

      set : function() {
      }
    }
  });

  // actually this is StringCoding.java
  var dummy_class = {
    "access_prefix": "",
    "extra_prefix": "",
    "long_desc": "<p>Utility class for string encoding and decoding.</p>",
    "members": {},
    "name": "StringCoding",
    "short_desc": "TODO",
    "since": "TODO",
    "type": "class"
  };

  it("should be able to render using view.ClassRenderer", function() {
    var v = new doc.view.ClassRenderer(dummy_class);

    spyOn(view_planes, 'set');
    spyOn(view_planes, 'push');
    v.push_to(view_planes);
    expect(view_planes.push).toHaveBeenCalled();
    expect(view_planes.set).not.toHaveBeenCalled();
  });


 it("should be able to preview using view.ClassRenderer", function() {
    var v = new doc.view.ClassRenderer(dummy_class);
    
    spyOn(view_planes, 'set');
    v.preview_to(view_planes);
    expect(view_planes.set).toHaveBeenCalled();
  });

});

