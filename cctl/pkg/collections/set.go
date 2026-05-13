package collections

// Set is a generic membership set backed by a map.
type Set[T comparable] map[T]struct{}

// NewSet creates a set populated with the provided values.
func NewSet[T comparable](values ...T) Set[T] {
	set := Set[T]{}
	set.Add(values...)

	return set
}

// Add inserts values into the set.
func (s Set[T]) Add(values ...T) {
	for _, value := range values {
		s[value] = struct{}{}
	}
}

// Has reports whether value is present in the set.
func (s Set[T]) Has(value T) bool {
	_, ok := s[value]

	return ok
}

// Values returns the set contents in unspecified order.
func (s Set[T]) Values() []T {
	values := make([]T, 0, len(s))
	for value := range s {
		values = append(values, value)
	}

	return values
}
