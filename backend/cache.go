package backend

import (
	"sync"
	"time"
)

type cacheValue[T any] struct {
	value     T
	expiresAt time.Time
}

type cacheFlight[T any] struct {
	done  chan struct{}
	value T
	err   error
}

// memoryCache retains successful work and coalesces concurrent requests for the same key.
type memoryCache[T any] struct {
	mutex   sync.Mutex
	values  map[string]cacheValue[T]
	flights map[string]*cacheFlight[T]
}

// newMemoryCache creates an empty application-lifetime cache.
func newMemoryCache[T any]() *memoryCache[T] {
	return &memoryCache[T]{values: make(map[string]cacheValue[T]), flights: make(map[string]*cacheFlight[T])}
}

// Get returns fresh cached data or lets exactly one caller perform the load.
func (cache *memoryCache[T]) Get(key string, lifetime time.Duration, load func() (T, error)) (T, error) {
	now := time.Now()
	cache.mutex.Lock()
	if cached, found := cache.values[key]; found && now.Before(cached.expiresAt) {
		cache.mutex.Unlock()
		return cached.value, nil
	}
	if flight, found := cache.flights[key]; found {
		cache.mutex.Unlock()
		<-flight.done
		return flight.value, flight.err
	}
	flight := &cacheFlight[T]{done: make(chan struct{})}
	cache.flights[key] = flight
	cache.mutex.Unlock()

	flight.value, flight.err = load()
	cache.mutex.Lock()
	if flight.err == nil {
		cache.values[key] = cacheValue[T]{value: flight.value, expiresAt: time.Now().Add(lifetime)}
	}
	delete(cache.flights, key)
	close(flight.done)
	cache.mutex.Unlock()
	return flight.value, flight.err
}

// Clear invalidates every completed value while leaving active callers safe.
func (cache *memoryCache[T]) Clear() {
	cache.mutex.Lock()
	clear(cache.values)
	cache.mutex.Unlock()
}

// Delete invalidates one repository-derived value.
func (cache *memoryCache[T]) Delete(key string) {
	cache.mutex.Lock()
	delete(cache.values, key)
	cache.mutex.Unlock()
}
