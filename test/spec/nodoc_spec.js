
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
});