package models

// KueueAvailability describes whether queue-backed scheduling is available
// for a namespace.
type KueueAvailability struct {
	Enabled              bool     `json:"enabled"`
	ClusterEnabled       bool     `json:"cluster_enabled"`
	NamespaceManaged     bool     `json:"namespace_managed"`
	LocalQueuesAvailable bool     `json:"local_queues_available"`
	LocalQueueNames      []string `json:"local_queue_names"`
}
