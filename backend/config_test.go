package backend

import "testing"

// TestNormalizeConfigBoundsScale keeps a corrupted or out-of-range scale value
// from shrinking or blowing up the entire desktop UI.
func TestNormalizeConfigBoundsScale(testingContext *testing.T) {
	cases := []struct {
		input    float64
		expected float64
	}{
		{input: 0, expected: 1},
		{input: 0.5, expected: 1},
		{input: 5, expected: 1},
		{input: 1.1, expected: 1.1},
	}
	for _, testCase := range cases {
		normalized := NormalizeConfig(Config{Scale: testCase.input})
		if normalized.Scale != testCase.expected {
			testingContext.Fatalf("scale %v: expected %v, received %v", testCase.input, testCase.expected, normalized.Scale)
		}
	}
}
