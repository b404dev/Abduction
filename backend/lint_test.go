package backend

import "testing"

func TestLintersAreFilteredByLanguage(t *testing.T) {
	linters := Linters("Python")
	if len(linters) != 2 || linters[0].Name != "ruff" || linters[1].Name != "pylint" {
		t.Fatalf("unexpected Python linter registry: %#v", linters)
	}
}

func TestStructuredDataLintersAreAvailable(t *testing.T) {
	if linters := Linters("YAML"); len(linters) != 1 || linters[0].Name != "yamllint" {
		t.Fatalf("unexpected YAML linter registry: %#v", linters)
	}
	if linters := Linters("JSON"); len(linters) != 2 || linters[0].Name != "biome" || linters[1].Name != "jq" {
		t.Fatalf("unexpected JSON linter registry: %#v", linters)
	}
	if linters := Linters("HCL"); len(linters) != 2 || linters[0].Name != "tflint" || linters[1].Name != "terraform-fmt" {
		t.Fatalf("unexpected Terraform linter registry: %#v", linters)
	}
}

func TestParseLintDiagnostics(t *testing.T) {
	diagnostics := parseLintDiagnostics("ruff", "src/app.py:12:7: F821 Undefined name `value`")
	if len(diagnostics) != 1 {
		t.Fatalf("expected one diagnostic, got %d", len(diagnostics))
	}
	if diagnostics[0].Path != "src/app.py" || diagnostics[0].Line != 12 || diagnostics[0].Column != 7 {
		t.Fatalf("unexpected diagnostic location: %#v", diagnostics[0])
	}
}
