
$(document).ready(function() {
  
  describe("nodoc", function() {

    var doc;
    beforeEach(function() {
      doc = new DocumentationViewer({
        base_folder : ".."
        });
    });

    // ------------------------------------------------------------------------------
    it("should be able to open the doc for class Object", function() {
      var ok = false;
      runs(function() {
        doc.open_class('../output/class_Object.json', function(result) {
          ok = result;
        });
      });

      waitsFor(function() {
        return ok;
      }, "callback should be called with result=true", 500);

      runs(function() {
        expect(ok).toBe(true);
      });
    });


    // ------------------------------------------------------------------------------
    it("should not be able to open the doc for class ThisClassDoesNotExist", function() {
      var ok = false;
      runs(function() {
        doc.open_class('../output/class_ThisClassDoesNotExist.json', function(result) {
          ok = !result;
        });
      });

      waitsFor(function() {
        return ok;
      }, "callback should be called with result=false", 500);

      runs(function() {
        expect(ok).toBe(true);
      });
    });

    // ------------------------------------------------------------------------------
    it("should be able to push and pop a view", function() {
      doc.push_view('<div id="test_l">','<div id="test_r">', {no_fade:true});
      expect($("#test_l").length).toBe(1);
      expect($("#test_r").length).toBe(1);

      doc.push_view('<div id="test_l2">','<div id="test_r2">', {no_fade:true});
      expect($("#test_l2").length).toBe(1);
      expect($("#test_r2").length).toBe(1);
      expect($("#test_l").length).toBe(0);
      expect($("#test_r").length).toBe(0);
    
      doc.pop_view({no_fade:true});
      expect($("#test_l").length).toBe(1);
      expect($("#test_r").length).toBe(1);
    });
  });
});