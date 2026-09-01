package backend

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// TestMemoryCacheCoalescesConcurrentLoads proves duplicate callers share one computation.
func TestMemoryCacheCoalescesConcurrentLoads(t *testing.T) {
	cache := newMemoryCache[int]()
	var loadCount atomic.Int32
	var waitGroup sync.WaitGroup
	results := make(chan int, 12)
	for requestIndex := 0; requestIndex < 12; requestIndex++ {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			value, loadError := cache.Get("repository", time.Minute, func() (int, error) {
				loadCount.Add(1)
				time.Sleep(15 * time.Millisecond)
				return 42, nil
			})
			if loadError != nil {
				t.Errorf("unexpected load error: %v", loadError)
			}
			results <- value
		}()
	}
	waitGroup.Wait()
	close(results)
	if loadCount.Load() != 1 {
		t.Fatalf("expected one load, got %d", loadCount.Load())
	}
	for result := range results {
		if result != 42 {
			t.Fatalf("expected cached value 42, got %d", result)
		}
	}
}

// TestMemoryCacheExpiryAndDelete proves stale or invalidated values are recomputed.
func TestMemoryCacheExpiryAndDelete(t *testing.T) {
	cache := newMemoryCache[int]()
	loadCount := 0
	load := func() (int, error) { loadCount++; return loadCount, nil }
	first, _ := cache.Get("repository", time.Millisecond, load)
	second, _ := cache.Get("repository", time.Millisecond, load)
	if first != 1 || second != 1 {
		t.Fatalf("expected cache hit, got %d and %d", first, second)
	}
	time.Sleep(2 * time.Millisecond)
	third, _ := cache.Get("repository", time.Minute, load)
	cache.Delete("repository")
	fourth, _ := cache.Get("repository", time.Minute, load)
	if third != 2 || fourth != 3 {
		t.Fatalf("expected expiry and deletion reloads, got %d and %d", third, fourth)
	}
}

// TestMemoryCacheDoesNotRetainErrors keeps transient failures retryable.
func TestMemoryCacheDoesNotRetainErrors(t *testing.T) {
	cache := newMemoryCache[int]()
	loadCount := 0
	load := func() (int, error) {
		loadCount++
		if loadCount == 1 {
			return 0, errors.New("transient")
		}
		return 7, nil
	}
	if _, firstError := cache.Get("repository", time.Minute, load); firstError == nil {
		t.Fatal("expected first load to fail")
	}
	value, secondError := cache.Get("repository", time.Minute, load)
	if secondError != nil || value != 7 || loadCount != 2 {
		t.Fatalf("expected successful retry, value=%d error=%v loads=%d", value, secondError, loadCount)
	}
}
